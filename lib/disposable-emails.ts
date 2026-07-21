// Block sign-ups from throwaway/temporary email providers. Bots lean on these to
// create disposable accounts. This is a curated list of common offenders — not
// exhaustive; extend as abuse patterns emerge. Real users occasionally use these
// too, so the message stays friendly and points them at a permanent address.
const DISPOSABLE_DOMAINS = new Set<string>([
  "mailinator.com",
  "guerrillamail.com",
  "guerrillamail.info",
  "sharklasers.com",
  "grr.la",
  "10minutemail.com",
  "10minutemail.net",
  "tempmail.com",
  "temp-mail.org",
  "tempmailo.com",
  "throwawaymail.com",
  "yopmail.com",
  "yopmail.net",
  "getnada.com",
  "nada.email",
  "dispostable.com",
  "trashmail.com",
  "maildrop.cc",
  "mailnesia.com",
  "fakeinbox.com",
  "mohmal.com",
  "moakt.com",
  "emailondeck.com",
  "burnermail.io",
  "mailsac.com",
  "spamgourmet.com",
  "mytemp.email",
  "tmpmail.org",
  "tempr.email",
  "discard.email",
  "einrot.com",
  "spam4.me",
]);

export function isDisposableEmail(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase().trim();
  return !!domain && DISPOSABLE_DOMAINS.has(domain);
}
