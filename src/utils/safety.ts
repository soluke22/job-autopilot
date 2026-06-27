export const APPLY_FLAG = "--i-understand-this-will-apply";
export const GMAIL_DRAFT_FLAG = "--i-understand-this-will-create-gmail-drafts";
export const RECRUITER_MESSAGE_FLAG = "--i-understand-this-will-message-recruiters";

function hasFlag(args: string[], flag: string) {
  return args.includes(flag);
}

export function assertMutationFlag(args: string[], kind: string, requiredFlag: string): void {
  if (hasFlag(args, requiredFlag)) {
    return;
  }

  throw new Error(
    [
      `${kind} is disabled by default in Job Radar mode.`,
      "This repository is configured for read-only job discovery, JD collection, scoring, and manual review.",
      `To run this archived mutation workflow anyway, pass ${requiredFlag}.`
    ].join(" ")
  );
}

export function assertApplyAutomationAllowed(args = process.argv): void {
  assertMutationFlag(args, "Apply automation and application form filling", APPLY_FLAG);
}

export function assertGmailDraftsAllowed(args = process.argv): void {
  assertMutationFlag(args, "Gmail draft creation", GMAIL_DRAFT_FLAG);
}

export function assertRecruiterMessagingAllowed(args = process.argv): void {
  assertMutationFlag(args, "Recruiter messaging or connection automation", RECRUITER_MESSAGE_FLAG);
}
