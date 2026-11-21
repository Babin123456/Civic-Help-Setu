import { getTerminologyGraph } from '../../src/data/terminologyGraph.js';
import { RELATIONSHIP_TYPES, EDGE_REVIEW_STATUS } from '../../src/data/terminologyGraph.js';
import { getAllServices, getServiceById } from '../../src/services/serviceCatalog.js';

// GET /api/graph - Get the terminology relationship graph data
export const GET = async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'overview';
    const category = searchParams.get('category') || null;
    const query = searchParams.get('query') || null;
    const reviewStatus = searchParams.get('review') || null; // 'pending', 'approved', 'rejected'
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    let nodes = [];
    let edges = [];
    let metadata = getTerminologyGraph().graphMetadata;

    // Filter by review status if specified
    if (reviewStatus) {
      if (reviewStatus === 'pending') {
        edges = getTerminologyGraph().getPendingEdges();
      } else if (reviewStatus === 'approved') {
        edges = getTerminologyGraph().getApprovedEdges();
      } else if (reviewStatus === 'rejected') {
        // Would need rejected edges stored separately
        edges = [];
      }
    } else {
      // Return approved edges by default for public view
      edges = getTerminologyGraph().getApprovedEdges();
    }

    // Filter by category if specified
    if (category) {
      const categoryNodes = edges.filter(
        (edge) =>
          edge.source.startsWith(category) || edge.target.startsWith(category)
      );
      // Would need more complex filtering
    }

    // Apply query search if provided
    if (query) {
      const matchingNodes = getTerminologyGraph().searchTerminology(query);
      const matchingNodeIds = new Set(matchingNodes.map((n) => n.id));

      // Filter nodes
      nodes = matchingNodes;

      // Filter edges to only those involving matching nodes
      edges = edges.filter(
        (edge) => matchingNodeIds.has(edge.source) || matchingNodeIds.has(edge.target)
      );
    } else {
      // Default: return all relevant nodes
      const relevantNodes = getTerminologyGraph().getRelevantTermsForIssue();
      nodes = relevantNodes;
    }

    // Apply pagination
    const totalEdges = edges.length;
    edges = edges.slice(offset, offset + limit);

    // Enrich edges with node data
    const enrichedEdges = edges.map((edge) => {
      const sourceNode = getTerminologyGraph().getRelevantTermsForIssue().find(
        (n) => n.id === edge.source
      );
      const targetNode = getTerminologyGraph().getRelevantTermsForIssue().find(
        (n) => n.id === edge.target
      );

      return {
        ...edge,
        sourceNode: sourceNode
          ? {
              id: sourceNode.id,
              term: sourceNode.term,
              category: sourceNode.category,
            }
          : { id: edge.source, term: edge.source },
        targetNode: targetNode
          ? {
              id: targetNode.id,
              term: targetNode.term,
              category: targetNode.category,
            }
          : { id: edge.target, term: edge.target },
        // Add visual distinction based on type
        visualCategory: getVisualCategoryForType(edge.type),
      };
    });

    // Get available categories for filter
    const availableCategories = [
      'certificate',
      'extract',
      'licence',
      'permit',
      'renewal',
      'correction',
      'reissue',
      'application',
    ];

    const response = {
      success: true,
      data: {
        nodes: nodes.map((node) => ({
          id: node.id,
          term: node.term,
          aliases: node.aliases,
          category: node.category,
          languageVariants: node.languageVariants,
          simpleMeaning: node.simpleMeaning,
          context: node.context,
          relatedServices: node.relatedServices,
          source: node.source,
        })),
        edges: enrichedEdges,
        metadata: {
          version: metadata.version,
          nodeCount: metadata.nodeCount,
          edgeCount: metadata.edgeCount,
          approvedEdgeCount: metadata.approvedEdgeCount,
          pendingEdgeCount: metadata.pendingEdgeCount,
          lastUpdated: metadata.lastUpdated,
        },
        filters: {
          categories: availableCategories,
          relationshipTypes: Object.values(RELATIONSHIP_TYPES),
          reviewStatuses: Object.values(EDGE_REVIEW_STATUS),
        },
        pagination: {
          total: nodes.length,
          limit,
          offset,
        },
      },
    };

    return new Response(JSON.stringify(response, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age: 60, stale-while-revalidate: 30',
      },
    });
  } catch (error) {
    console.error('Error fetching terminology graph:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Failed to fetch terminology graph data',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};

// POST /api/graph/review - Submit a relationship for review (admin)
export const POST = async (request) => {
  try {
    const body = await request.json();

    // Validate the payload
    const { type, source, target, description, sourceReference, reviewerId, reviewerComments } =
      body;

    // Validate required fields
    if (!type) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Relationship type is required',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    if (!source || typeof source !== 'string' || source.trim() === '') {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Source node ID is required',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    if (!target || typeof target !== 'string' || target.trim() === '') {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Target node ID is required',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    if (!description || typeof description !== 'string' || description.trim() === '') {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Description is required',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Validate the relationship type
    const validTypes = Object.values(RELATIONSHIP_TYPES);
    if (!validTypes.includes(type)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Invalid relationship type. Must be one of: ${validTypes.join(', ')}`,
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Validate sourceReference
    if (
      !sourceReference ||
      typeof sourceReference.name !== 'string' ||
      sourceReference.name.trim() === ''
    ) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Source reference with name is required',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // In a real implementation, this would:
    // 1. Create a new edge in PENDING status
    // 2. Store it in a review queue
    // 3. Notify admins

    const newEdge = {
      id: `edge-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      source,
      target,
      type,
      description: description.trim(),
      sourceReference: {
        name: sourceReference.name.trim(),
        version: sourceReference.version || '1.0',
      },
      reviewStatus: EDGE_REVIEW_STATUS.PENDING,
      createdAt: new Date().toISOString(),
      reviewerId: reviewerId || null,
      reviewerComments: reviewerComments || null,
    };

    // Return success - in production this would persist to database
    return new Response(
      JSON.stringify({
        success: true,
        data: newEdge,
        message: 'Relationship proposal submitted for editorial review.',
      }),
      {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error submitting relationship for review:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Failed to submit relationship for review',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};

// GET /api/graph/review/queue - Get the admin review queue
export const GET_REVIEW_QUEUE = async (request) => {
  try {
    // In a real implementation, this would fetch from a database
    // For now, return pending edges from the terminology graph
    const pendingEdges = getTerminologyGraph().getPendingEdges();

    const queueItems = pendingEdges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: edge.type,
      description: edge.description,
      sourceReference: edge.sourceReference,
      createdAt: edge.createdAt,
      reviewStatus: edge.reviewStatus,
    }));

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          items: queueItems,
          total: queueItems.length,
        },
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      }
    );
  } catch (error) {
    console.error('Error fetching review queue:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Failed to fetch review queue',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};

// POST /api/graph/review/approve - Approve a relationship edge (admin)
export const POST_APPROVE = async (request) => {
  try {
    const body = await request.json();
    const { edgeId } = body;

    if (!edgeId || typeof edgeId !== 'string' || edgeId.trim() === '') {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Edge ID is required',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // In a real implementation, this would update the edge status in the database
    // and notify relevant parties
    const approvedEdge = {
      id: edgeId,
      reviewStatus: 'approved',
      approvedAt: new Date().toISOString(),
    };

    return new Response(
      JSON.stringify({
        success: true,
        data: approvedEdge,
        message: 'Relationship edge approved successfully.',
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error approving relationship:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Failed to approve relationship',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};

// POST /api/graph/review/reject - Reject a relationship edge (admin)
export const POST_REJECT = async (request) => {
  try {
    const body = await request.json();
    const { edgeId } = body;

    if (!edgeId || typeof edgeId !== 'string' || edgeId.trim() === '') {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Edge ID is required',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // In a real implementation, this would update the edge status in the database
    const rejectedEdge = {
      id: edgeId,
      reviewStatus: 'rejected',
      rejectedAt: new Date().toISOString(),
    };

    return new Response(
      JSON.stringify({
        success: true,
        data: rejectedEdge,
        message: 'Relationship edge rejected.',
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error rejecting relationship:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Failed to reject relationship',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};

// Helper function to get visual category for relationship type
const getVisualCategoryForType = (type) => {
  const visualMap = {
    [RELATIONSHIP_TYPES.SYNONYM]: 'synonym',
    [RELATIONSHIP_TYPES.PREREQUISITE]: 'prerequisite',
    [RELATIONSHIP_TYPES.RELATED]: 'related',
    [RELATIONSHIP_TYPES.CONFUSING]: 'confusing',
    [RELATIONSHIP_TYPES.ALTERNATIVE]: 'alternative',
  };
  return visualMap[type] || 'related';
};
