// A.6 — a refusal read as a Problem Document (RFC 9457), not as text.
//
// The service answers application/problem+json with type, title, detail and,
// where fields were refused, an `invalid-params` list of { name, reason }.
// Translating that here, once, is what lets a form put each message on the
// field it belongs to instead of dropping one red banner at the top of the
// page.
export class Problem extends Error {
  constructor(message, status, body = null) {
    super(message);

    this.name = "Problem";
    this.status = status;
    this.body = body;

    // The stable identifier. Client code branches on this rather than on
    // wording, which is free to change.
    this.type = body?.type ?? null;
    this.title = body?.title ?? null;
    this.detail = body?.detail ?? null;

    // Indexed by field name, because that is how a form asks: "is there
    // anything to say about this input?"
    this.invalidParams = Object.fromEntries(
      (body?.["invalid-params"] ?? [])
        .filter((param) => param && typeof param.name === "string")
        .map((param) => [param.name, param.reason])
    );
  }

  // The message for one field, or undefined when the service said nothing
  // about it.
  fieldReason(name) {
    return this.invalidParams[name];
  }

  // True when the service named at least one field. A 400 that names none
  // is not a field problem — it belongs at the level of the form, and it
  // also means the service's error catalogue has a gap worth fixing there
  // rather than guessing at here.
  get hasFieldReasons() {
    return Object.keys(this.invalidParams).length > 0;
  }

  // A.8 — somebody else wrote first. This is a normal condition, not a
  // system failure: the work was refused, nothing was changed, and the
  // client's move is to re-read and show the user what is actually there.
  get isConflict() {
    return this.status === 412;
  }

  // The client sent no precondition at all. A bug in this application
  // rather than anything the user did, so it is worth telling them apart
  // from a genuine conflict while developing.
  get isPreconditionMissing() {
    return this.status === 428;
  }

  // What to show when there is nothing field-specific to say. `detail` is
  // written for this occurrence, `title` is fixed per type; either is in
  // domain terms, which "Request failed with status code 409" is not.
  get sentence() {
    return this.detail || this.title || this.message;
  }
}
