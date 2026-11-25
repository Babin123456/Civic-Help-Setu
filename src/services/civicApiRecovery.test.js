import { describe, expect, it, vi } from 'vitest';
import { createAppeal, AbuseControlPlaneError } from './abuseControlPlaneService.js';
import { requestServerScan, VisualQaApiError } from './catalogueVisualQaService.js';
const id='12345678-1234-4567-8123-123456789abc';
describe('existing client recovery integration',()=>{
 it('abuse appeals retain typed retry information without copying diagnostics',async()=>{
  vi.stubGlobal('fetch',async()=>new Response(JSON.stringify({errorVersion:1,code:'RATE_LIMITED',error:'SYNTHETIC_PRIVATE_SENTINEL',details:'SYNTHETIC_PRIVATE_SENTINEL',retryAfterSeconds:7,correlationId:id}),{status:429}));
  try{await createAppeal({route:'synthetic',reason:'Synthetic fixture'});throw new Error('Expected failure');}
  catch(error){expect(error).toBeInstanceOf(AbuseControlPlaneError);expect(error.code).toBe('RATE_LIMITED');expect(error.meta.retryAfterSeconds).toBe(7);expect(error.correlationId).toBe(id);expect(JSON.stringify(error)).not.toContain('SENTINEL');expect(error.message).not.toContain('SENTINEL');}
 });
 it('abuse network failures suppress raw transport errors',async()=>{
  vi.stubGlobal('fetch',async()=>{throw new Error('SYNTHETIC_PRIVATE_SENTINEL');});
  await expect(createAppeal({})).rejects.toMatchObject({code:'NETWORK_ERROR',recoveryAction:'check_connection'});
 });
 it('visual QA handles unreadable authorization responses by status instead of message parsing',async()=>{
  await expect(requestServerScan({}, {fetchImpl:async()=>new Response('SYNTHETIC_PRIVATE_SENTINEL',{status:401})})).rejects.toMatchObject({code:'UNAUTHENTICATED',recoveryAction:'sign_in',retryable:false,fields:[]});
 });
 it('visual QA retains correlation IDs and bounded retry delays',async()=>{
  await expect(requestServerScan({}, {fetchImpl:async()=>new Response(JSON.stringify({errorVersion:1,code:'RATE_LIMITED',retryAfterSeconds:2}),{status:429,headers:{'X-Correlation-ID':id}})})).rejects.toMatchObject({code:'RATE_LIMITED',retryAfterSeconds:2,correlationId:id});
 });
 it('visual QA classifies network and malformed success responses safely',async()=>{
  for(const[fetchImpl,code]of[[async()=>{throw new Error('SYNTHETIC_PRIVATE_SENTINEL');},'NETWORK_ERROR'],[async()=>new Response('SYNTHETIC_PRIVATE_SENTINEL',{status:200}),'INVALID_RESPONSE']]){
   try{await requestServerScan({}, {fetchImpl});throw new Error('Expected failure');}catch(error){expect(error).toBeInstanceOf(VisualQaApiError);expect(error.code).toBe(code);expect(error.message).not.toContain('SENTINEL');}
  }
 });
});
