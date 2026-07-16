export type GeometryPoint = {
  x: number;
  y: number;
};

const GEOMETRY_EPSILON = 1e-9;

export const distanceSquaredPointToSegment = (
  point: GeometryPoint,
  segmentStart: GeometryPoint,
  segmentEnd: GeometryPoint,
): number => {
  const segmentX = segmentEnd.x - segmentStart.x;
  const segmentY = segmentEnd.y - segmentStart.y;
  const segmentLengthSquared = segmentX * segmentX + segmentY * segmentY;

  if (segmentLengthSquared <= GEOMETRY_EPSILON) {
    return distanceSquared(point, segmentStart);
  }

  const projection = clamp(
    ((point.x - segmentStart.x) * segmentX +
      (point.y - segmentStart.y) * segmentY) /
      segmentLengthSquared,
    0,
    1,
  );
  const closestPoint = {
    x: segmentStart.x + projection * segmentX,
    y: segmentStart.y + projection * segmentY,
  };

  return distanceSquared(point, closestPoint);
};

export const distanceSquaredBetweenSegments = (
  firstStart: GeometryPoint,
  firstEnd: GeometryPoint,
  secondStart: GeometryPoint,
  secondEnd: GeometryPoint,
): number => {
  if (segmentsIntersect(firstStart, firstEnd, secondStart, secondEnd)) {
    return 0;
  }

  return Math.min(
    distanceSquaredPointToSegment(firstStart, secondStart, secondEnd),
    distanceSquaredPointToSegment(firstEnd, secondStart, secondEnd),
    distanceSquaredPointToSegment(secondStart, firstStart, firstEnd),
    distanceSquaredPointToSegment(secondEnd, firstStart, firstEnd),
  );
};

const segmentsIntersect = (
  firstStart: GeometryPoint,
  firstEnd: GeometryPoint,
  secondStart: GeometryPoint,
  secondEnd: GeometryPoint,
): boolean => {
  const firstStartSide = crossProduct(firstStart, firstEnd, secondStart);
  const firstEndSide = crossProduct(firstStart, firstEnd, secondEnd);
  const secondStartSide = crossProduct(secondStart, secondEnd, firstStart);
  const secondEndSide = crossProduct(secondStart, secondEnd, firstEnd);

  if (
    haveOppositeSigns(firstStartSide, firstEndSide) &&
    haveOppositeSigns(secondStartSide, secondEndSide)
  ) {
    return true;
  }

  return (
    (isNearlyZero(firstStartSide) && pointIsOnSegment(secondStart, firstStart, firstEnd)) ||
    (isNearlyZero(firstEndSide) && pointIsOnSegment(secondEnd, firstStart, firstEnd)) ||
    (isNearlyZero(secondStartSide) && pointIsOnSegment(firstStart, secondStart, secondEnd)) ||
    (isNearlyZero(secondEndSide) && pointIsOnSegment(firstEnd, secondStart, secondEnd))
  );
};

const crossProduct = (
  segmentStart: GeometryPoint,
  segmentEnd: GeometryPoint,
  point: GeometryPoint,
): number =>
  (segmentEnd.x - segmentStart.x) * (point.y - segmentStart.y) -
  (segmentEnd.y - segmentStart.y) * (point.x - segmentStart.x);

const pointIsOnSegment = (
  point: GeometryPoint,
  segmentStart: GeometryPoint,
  segmentEnd: GeometryPoint,
): boolean =>
  point.x >= Math.min(segmentStart.x, segmentEnd.x) - GEOMETRY_EPSILON &&
  point.x <= Math.max(segmentStart.x, segmentEnd.x) + GEOMETRY_EPSILON &&
  point.y >= Math.min(segmentStart.y, segmentEnd.y) - GEOMETRY_EPSILON &&
  point.y <= Math.max(segmentStart.y, segmentEnd.y) + GEOMETRY_EPSILON;

const haveOppositeSigns = (first: number, second: number): boolean =>
  (first > GEOMETRY_EPSILON && second < -GEOMETRY_EPSILON) ||
  (first < -GEOMETRY_EPSILON && second > GEOMETRY_EPSILON);

const isNearlyZero = (value: number): boolean => Math.abs(value) <= GEOMETRY_EPSILON;

const distanceSquared = (first: GeometryPoint, second: GeometryPoint): number => {
  const x = first.x - second.x;
  const y = first.y - second.y;
  return x * x + y * y;
};

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);
