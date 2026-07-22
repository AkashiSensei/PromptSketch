export type GeometryPoint = {
  x: number;
  y: number;
};

export type ShapeKind = "rectangle" | "ellipse" | "rounded-rectangle" | "line";

export type ClosedShapeKind = Exclude<ShapeKind, "line">;

export type ShapeBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
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

export const distanceSquaredBetweenPoints = (
  first: GeometryPoint,
  second: GeometryPoint,
): number => distanceSquared(first, second);

export const getSnappedLineEnd = (
  start: GeometryPoint,
  end: GeometryPoint,
): GeometryPoint => {
  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;
  const length = Math.hypot(deltaX, deltaY);

  if (length <= GEOMETRY_EPSILON) {
    return { x: start.x, y: start.y };
  }

  const snapIncrement = Math.PI / 4;
  const angle = Math.atan2(deltaY, deltaX);
  const snappedAngle = Math.round(angle / snapIncrement) * snapIncrement;

  return {
    x: start.x + Math.cos(snappedAngle) * length,
    y: start.y + Math.sin(snappedAngle) * length,
  };
};

export const getShapeBounds = (
  start: GeometryPoint,
  end: GeometryPoint,
  constrainAspectRatio = false,
): ShapeBounds => {
  let endX = end.x;
  let endY = end.y;

  if (constrainAspectRatio) {
    const width = end.x - start.x;
    const height = end.y - start.y;
    const size = Math.max(Math.abs(width), Math.abs(height));
    endX = start.x + size * directionOrFallback(width, height);
    endY = start.y + size * directionOrFallback(height, width);
  }

  return {
    x: Math.min(start.x, endX),
    y: Math.min(start.y, endY),
    width: Math.abs(endX - start.x),
    height: Math.abs(endY - start.y),
  };
};

export const getRoundedRectRadius = (
  bounds: ShapeBounds,
  preferredRadius = 20,
): number => Math.max(0, Math.min(preferredRadius, bounds.width / 2, bounds.height / 2));

export const lineIntersectsSweptCircle = (
  lineStart: GeometryPoint,
  lineEnd: GeometryPoint,
  sweepStart: GeometryPoint,
  sweepEnd: GeometryPoint,
  eraserRadius: number,
  strokeWidth: number,
): boolean => {
  const hitRadius = eraserRadius + strokeWidth / 2;

  return (
    distanceSquaredBetweenSegments(lineStart, lineEnd, sweepStart, sweepEnd) <=
    hitRadius * hitRadius
  );
};

export const shapeIntersectsSweptCircle = (
  kind: ClosedShapeKind,
  bounds: ShapeBounds,
  sweepStart: GeometryPoint,
  sweepEnd: GeometryPoint,
  eraserRadius: number,
  strokeWidth: number,
  isFilled: boolean,
  roundedRectRadius = 0,
): boolean => {
  if (bounds.width <= GEOMETRY_EPSILON || bounds.height <= GEOMETRY_EPSILON) {
    return false;
  }

  const boundary = getShapeBoundary(kind, bounds, roundedRectRadius);
  const borderHitRadius = eraserRadius + strokeWidth / 2;

  if (polylineIntersectsSweep(boundary, sweepStart, sweepEnd, borderHitRadius)) {
    return true;
  }

  return (
    isFilled &&
    (pointIsInsideShape(kind, sweepStart, bounds, roundedRectRadius) ||
      pointIsInsideShape(kind, sweepEnd, bounds, roundedRectRadius))
  );
};

const directionOrFallback = (value: number, fallback: number): number => {
  if (value !== 0) {
    return Math.sign(value);
  }

  return fallback < 0 ? -1 : 1;
};

const getShapeBoundary = (
  kind: ClosedShapeKind,
  bounds: ShapeBounds,
  roundedRectRadius: number,
): GeometryPoint[] => {
  if (kind === "ellipse") {
    return getEllipseBoundary(bounds);
  }

  if (kind === "rounded-rectangle") {
    return getRoundedRectBoundary(bounds, roundedRectRadius);
  }

  return [
    { x: bounds.x, y: bounds.y },
    { x: bounds.x + bounds.width, y: bounds.y },
    { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
    { x: bounds.x, y: bounds.y + bounds.height },
  ];
};

const getEllipseBoundary = (bounds: ShapeBounds): GeometryPoint[] => {
  const centerX = bounds.x + bounds.width / 2;
  const centerY = bounds.y + bounds.height / 2;
  const radiusX = bounds.width / 2;
  const radiusY = bounds.height / 2;
  const segmentCount = 64;

  return Array.from({ length: segmentCount }, (_, index) => {
    const angle = (index / segmentCount) * Math.PI * 2;
    return {
      x: centerX + Math.cos(angle) * radiusX,
      y: centerY + Math.sin(angle) * radiusY,
    };
  });
};

const getRoundedRectBoundary = (
  bounds: ShapeBounds,
  preferredRadius: number,
): GeometryPoint[] => {
  const radius = getRoundedRectRadius(bounds, preferredRadius);

  if (radius <= GEOMETRY_EPSILON) {
    return getShapeBoundary("rectangle", bounds, 0);
  }

  const points: GeometryPoint[] = [];
  const arcSegments = 8;
  const corners = [
    { x: bounds.x + radius, y: bounds.y + radius, start: Math.PI },
    {
      x: bounds.x + bounds.width - radius,
      y: bounds.y + radius,
      start: Math.PI * 1.5,
    },
    {
      x: bounds.x + bounds.width - radius,
      y: bounds.y + bounds.height - radius,
      start: 0,
    },
    {
      x: bounds.x + radius,
      y: bounds.y + bounds.height - radius,
      start: Math.PI * 0.5,
    },
  ];

  corners.forEach((corner) => {
    for (let index = 0; index <= arcSegments; index += 1) {
      const angle = corner.start + (index / arcSegments) * (Math.PI / 2);
      points.push({
        x: corner.x + Math.cos(angle) * radius,
        y: corner.y + Math.sin(angle) * radius,
      });
    }
  });

  return points;
};

const polylineIntersectsSweep = (
  points: GeometryPoint[],
  sweepStart: GeometryPoint,
  sweepEnd: GeometryPoint,
  hitRadius: number,
): boolean => {
  const hitRadiusSquared = hitRadius * hitRadius;

  return points.some((point, index) => {
    const nextPoint = points[(index + 1) % points.length];
    return (
      distanceSquaredBetweenSegments(sweepStart, sweepEnd, point, nextPoint) <=
      hitRadiusSquared
    );
  });
};

const pointIsInsideShape = (
  kind: ClosedShapeKind,
  point: GeometryPoint,
  bounds: ShapeBounds,
  roundedRectRadius: number,
): boolean => {
  if (kind === "ellipse") {
    const radiusX = bounds.width / 2;
    const radiusY = bounds.height / 2;
    const normalizedX = (point.x - (bounds.x + radiusX)) / radiusX;
    const normalizedY = (point.y - (bounds.y + radiusY)) / radiusY;
    return normalizedX * normalizedX + normalizedY * normalizedY <= 1;
  }

  if (!pointIsInsideBounds(point, bounds)) {
    return false;
  }

  if (kind === "rectangle") {
    return true;
  }

  const radius = getRoundedRectRadius(bounds, roundedRectRadius);

  if (
    point.x >= bounds.x + radius &&
    point.x <= bounds.x + bounds.width - radius
  ) {
    return true;
  }

  if (
    point.y >= bounds.y + radius &&
    point.y <= bounds.y + bounds.height - radius
  ) {
    return true;
  }

  const cornerX =
    point.x < bounds.x + radius ? bounds.x + radius : bounds.x + bounds.width - radius;
  const cornerY =
    point.y < bounds.y + radius
      ? bounds.y + radius
      : bounds.y + bounds.height - radius;

  return distanceSquared(point, { x: cornerX, y: cornerY }) <= radius * radius;
};

const pointIsInsideBounds = (point: GeometryPoint, bounds: ShapeBounds): boolean =>
  point.x >= bounds.x &&
  point.x <= bounds.x + bounds.width &&
  point.y >= bounds.y &&
  point.y <= bounds.y + bounds.height;

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
