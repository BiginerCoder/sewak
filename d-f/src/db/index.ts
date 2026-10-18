export const db = {
  select: () => ({
    from: () => ({
      where: () => ({
        orderBy: () => [],
      }),
      orderBy: () => [],
    }),
  }),
  insert: () => ({
    values: () => ({
      returning: () => [],
      onConflictDoNothing: () => ({ returning: () => [] }),
      onConflictDoUpdate: () => ({ returning: () => [] }),
    }),
  }),
  update: () => ({
    set: () => ({
      where: () => ({ }),
    }),
  }),
  delete: () => ({
    where: () => ({ }),
  }),
  execute: async () => undefined,
  transaction: async (fn: (tx: any) => Promise<void>) => fn({
    execute: async () => undefined,
    select: () => ({ from: () => ({ where: () => ({}) }) }),
    insert: () => ({ values: () => ({ returning: () => [] }) }),
    update: () => ({ set: () => ({ where: () => ({}) }) }),
    delete: () => ({ where: () => ({}) }),
  }),
};

export const pool = {
  query: async () => ({ rows: [] }),
};
