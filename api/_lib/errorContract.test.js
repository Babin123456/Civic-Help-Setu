import { describe, expect, it, vi } from 'vitest';
import { createServer } from 'node:http';
import { withApiErrorContract } from './errorContract.js';
import { API_ERRORS, validCorrelationId, apiFailureError } from '../../src/utils/civicErrorContract.js';
const mock = () => ({ statusCode: 200, headers: {}, body: null, setHeader(name,value) { this.headers[name.toLowerCase()]=value; }, getHeader(name) { return this.headers[name.toLowerCase()]; }, status(code) { this.statusCode=code; return this; }, json(body) { this.body=body; this.writableEnded=true; return this; } });

describe('API error boundary', () => {
 it.each([400,401,403,404,405,409,413,422,429,500,502,503,504])('publishes only a stable safe contract for HTTP %s', async status => {
  const res=mock();await withApiErrorContract((_req,response)=>response.status(status).json({ error: 'SYNTHETIC_PRIVATE_SENTINEL', stack: 'SYNTHETIC_PRIVATE_SENTINEL', details: { token: 'SYNTHETIC_PRIVATE_SENTINEL' } }))({},res);
  expect(res.statusCode).toBe(status);expect(validCorrelationId(res.body.correlationId)).toBe(true);expect(res.body.errorVersion).toBe(1);
  expect(Object.hasOwn(API_ERRORS,res.body.code)).toBe(true);expect(JSON.stringify(res.body)).not.toContain('SYNTHETIC_PRIVATE_SENTINEL');expect(res.headers['cache-control']).toBe('no-store');
 });
 it('preserves successful payloads and authorization headers', async () => {
  const res=mock();await withApiErrorContract((_req,response)=>{response.setHeader('Set-Cookie','synthetic=1; HttpOnly');return response.status(201).json({ok:true,id:'synthetic'});})({},res);
  expect(res.body).toEqual({ok:true,id:'synthetic'});expect(res.headers['set-cookie']).toBe('synthetic=1; HttpOnly');expect(res.statusCode).toBe(201);
 });
 it('normalizes legacy returned objects, direct statusCode writes and logical errors', async () => {
  for (const handler of [()=>({status:429,headers:{'Retry-After':'12'},body:{error:'private'}}),(_req,res)=>{res.statusCode=429;return res.json({error:'private',retryAfterSeconds:12});},(_req,res)=>res.json({ok:false,error:'private'})]) {
   const res=mock();await withApiErrorContract(handler)({},res);expect(res.body.errorVersion).toBe(1);expect(res.statusCode).toBeGreaterThanOrEqual(400);expect(JSON.stringify(res.body)).not.toContain('private');
   if(res.statusCode===429)expect(res.body.retryAfterSeconds).toBe(12);
  }
 });
 it('ignores forged IDs and untrusted retry/codes; concurrent requests stay isolated', async () => {
  const handler=withApiErrorContract(async (_req,res)=>{await Promise.resolve();res.setHeader('X-Correlation-ID','forged');return res.status(403).json({errorVersion:1,code:'RATE_LIMITED',retryAfterSeconds:999999});});
  const results=await Promise.all(Array.from({length:100},async()=>{const res=mock();await handler({headers:{'x-correlation-id':'forged'}},res);return res;}));
  expect(new Set(results.map(res=>res.body.correlationId)).size).toBe(100);
  for(const res of results){expect(res.body.code).toBe('FORBIDDEN');expect(res.body.retryable).toBe(false);expect(res.body.retryAfterSeconds).toBeUndefined();expect(res.headers['x-correlation-id']).toBe(res.body.correlationId);}
 });
 it('handles thrown handlers and failed logging without revealing request or exception data', async () => {
  const res=mock();const log=vi.fn(()=>{throw new Error('private logger');});
  await withApiErrorContract(()=>{throw new Error('SYNTHETIC_PRIVATE_SENTINEL');},{log})({url:'/token=SYNTHETIC_PRIVATE_SENTINEL'},res);
  expect(res.statusCode).toBe(500);expect(res.body.code).toBe('INTERNAL_ERROR');expect(JSON.stringify(res.body)+JSON.stringify(log.mock.calls)).not.toContain('SYNTHETIC_PRIVATE_SENTINEL');
 });
 it('does not double-send after a response has started', async () => {
  const res=mock();res.json=vi.fn(res.json);
  await withApiErrorContract((_req,response)=>{response.json({ok:true});throw new Error('later');},{log:()=>{}})({},res);
  expect(res.json).toHaveBeenCalledTimes(1);expect(res.body).toEqual({ok:true});
 });
 it('normalizes an unreadable standard Response error without reading its sensitive body', async () => {
  const res=mock();await withApiErrorContract(()=>new Response('SYNTHETIC_PRIVATE_SENTINEL',{status:503,headers:{'Retry-After':'8'}}))({},res);
  expect(res.body.code).toBe('DEPENDENCY_UNAVAILABLE');expect(res.body.retryAfterSeconds).toBe(8);expect(JSON.stringify(res.body)).not.toContain('SYNTHETIC_PRIVATE_SENTINEL');
 });
 it('round-trips real HTTP errors through the browser client contract', async () => {
  const handle=withApiErrorContract((_req,res)=>res.status(429).json({error:'SYNTHETIC_PRIVATE_SENTINEL',retryAfterSeconds:3}));
  const server=createServer((req,res)=>{res.status=function(code){this.statusCode=code;return this;};res.json=function(body){this.setHeader('Content-Type','application/json');this.end(JSON.stringify(body));return this;};handle(req,res);});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try {const response=await fetch(`http://127.0.0.1:${server.address().port}`);const body=await response.json();const error=apiFailureError(response,body);expect(error.code).toBe('RATE_LIMITED');expect(error.retryable).toBe(true);expect(error.retryAfterSeconds).toBe(3);expect(error.correlationId).toBe(response.headers.get('X-Correlation-ID'));expect(error.message).not.toContain('SENTINEL');}
  finally {await new Promise(resolve=>server.close(resolve));}
 });
});
