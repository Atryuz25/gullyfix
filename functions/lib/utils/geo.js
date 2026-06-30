"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.haversineMeters = haversineMeters;
exports.latLngBoundingBox = latLngBoundingBox;
/**
 * Haversine formula — computes the great-circle distance between two
 * lat/lng coordinates in metres.
 */
function haversineMeters(lat1, lng1, lat2, lng2) {
    const R = 6371000; // Earth's radius in metres
    const toRad = (deg) => (deg * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
/**
 * Computes a lat/lng bounding box for a given centre point and radius (in km).
 * Used to build a cheap Firestore range query before the precise Haversine check.
 */
function latLngBoundingBox(lat, lng, radiusKm) {
    const latDelta = radiusKm / 111.32;
    const lngDelta = radiusKm / (111.32 * Math.cos((lat * Math.PI) / 180));
    return {
        minLat: lat - latDelta,
        maxLat: lat + latDelta,
        minLng: lng - lngDelta,
        maxLng: lng + lngDelta,
    };
}
//# sourceMappingURL=geo.js.map