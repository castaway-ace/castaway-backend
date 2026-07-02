export const toJson = <T>(value: T): unknown =>
  JSON.parse(JSON.stringify(value));
