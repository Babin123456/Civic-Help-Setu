import { describe, it, expect, beforeEach } from 'vitest';
import {
  NODE_TYPES,
  EDGE_TYPES,
  CivicKnowledgeEntityGraph,
} from './civicEntityGraphService';

const MOCK_SERVICE_A = {
  id: 'driving-licence',
  title: 'Permanent Driving Licence',
  status: 'published',
  department: 'Ministry of Road Transport and Highways',
  officialUrl: 'https://parivahan.gov.in',
  documents: ['Form 1A Medical Certificate', 'Aadhaar Card', 'Learner Licence'],
  jurisdiction: 'National',
};

const MOCK_SERVICE_B = {
  id: 'vehicle-rc',
  title: 'Vehicle Registration Certificate',
  status: 'published',
  department: 'Ministry of Road Transport and Highways',
  officialUrl: 'https://parivahan.gov.in',
  documents: ['Aadhaar Card', 'Form 20 Application'],
  jurisdiction: 'National',
};

describe('Civic Knowledge Entity Graph (#611)', () => {
  let graph;

  beforeEach(() => {
    graph = new CivicKnowledgeEntityGraph();
    graph.ingestService(MOCK_SERVICE_A);
    graph.ingestService(MOCK_SERVICE_B);
  });

  it('builds nodes for services, departments, documents, and portals', () => {
    expect(graph.nodes.has('service:driving-licence')).toBe(true);
    expect(graph.nodes.has('service:vehicle-rc')).toBe(true);
    expect(
      graph.nodes.has('department:ministry-of-road-transport-and-highways')
    ).toBe(true);
  });

  it('attaches explicit provenance to every edge', () => {
    for (const edge of graph.edges) {
      expect(edge.provenance).toBeDefined();
      expect(edge.provenance.serviceId).toBeDefined();
      expect(edge.provenance.field).toBeDefined();
      expect(edge.provenance.timestamp).toBeGreaterThan(0);
    }
  });

  it('performs bounded graph expansion across related entities', () => {
    // 2-hop traversal from Driving Licence should reach Vehicle RC through shared department or shared document
    const neighbors = graph.expandEntityNeighbors('service:driving-licence', 2);
    expect(neighbors.length).toBeGreaterThan(0);

    const labels = neighbors.map((n) => n.node.label);
    expect(labels).toContain('Ministry of Road Transport and Highways');
    expect(labels).toContain('Aadhaar Card');
  });

  it('cascades edge deletion when a service is removed or archived', () => {
    graph.removeService('driving-licence');
    expect(graph.nodes.has('service:driving-licence')).toBe(false);

    // Edges originating from driving-licence should be removed
    const dlEdges = graph.edges.filter(
      (e) => e.provenance?.serviceId === 'driving-licence'
    );
    expect(dlEdges.length).toBe(0);

    // Vehicle RC edges must remain intact
    const rcEdges = graph.edges.filter(
      (e) => e.provenance?.serviceId === 'vehicle-rc'
    );
    expect(rcEdges.length).toBeGreaterThan(0);
  });

  it('excludes unapproved or draft services from graph ingestion', () => {
    const draftService = {
      id: 'draft-pension',
      title: 'Draft Old Age Pension',
      isDraft: true,
      status: 'pending',
    };

    const ingested = graph.ingestService(draftService);
    expect(ingested).toBe(false);
    expect(graph.nodes.has('service:draft-pension')).toBe(false);
  });
});
