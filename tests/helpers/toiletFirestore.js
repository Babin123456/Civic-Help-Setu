/** Transactional test double for adapter contract tests, never a production fallback. */
export class ToiletFirestoreFixture {
  records = new Map();
  tail = Promise.resolve();
  failNext = false;

  collection() {
    const db = this;
    function query(after = null, limit = 1000) {
      return {
        orderBy: () => query(after, limit),
        startAfter: (time, id) => query([time, id], limit),
        limit: count => query(after, count),
        get: async () => ({
          docs: [...db.records.entries()]
            .sort(([a, x], [b, y]) => y.createdAt - x.createdAt || b.localeCompare(a))
            .filter(([id, row]) => !after || row.createdAt < after[0] || (row.createdAt === after[0] && id < after[1]))
            .slice(0, limit).map(([id, row]) => ({ id, data: () => structuredClone(row) })),
        }),
      };
    }
    return { doc: id => ({ id }), ...query() };
  }

  runTransaction(work) {
    const execution = this.tail.then(async () => {
      if (this.failNext) { this.failNext = false; throw new Error('injected storage failure'); }
      const draft = new Map([...this.records].map(([id, row]) => [id, structuredClone(row)]));
      const result = await work({
        get: async ref => ({ exists: draft.has(ref.id), data: () => structuredClone(draft.get(ref.id)) }),
        create: (ref, data) => {
          if (draft.has(ref.id)) throw new Error('duplicate');
          draft.set(ref.id, structuredClone(data));
        },
        update: (ref, data) => draft.set(ref.id, { ...draft.get(ref.id), ...structuredClone(data) }),
      });
      this.records = draft;
      return result;
    });
    this.tail = execution.catch(() => {});
    return execution;
  }
}
