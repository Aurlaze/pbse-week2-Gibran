function toCourtRepresentation(court) {
  return {
    id: court.id,
    name: court.name,
    location: court.location,
    courtType: court.court_type,
    isAvailable: court.is_available,
    status: court.status
  };
}

// The Retirement schema from openapi.yaml: a record of its own, which is
// what a sub-resource buys over a PATCH setting status.
function toRetirementRepresentation(court) {
  return {
    courtId: court.id,
    reason: court.retire_reason,
    retiredAt: new Date(court.retired_at).toISOString()
  };
}

module.exports = {
  toCourtRepresentation,
  toRetirementRepresentation
};
