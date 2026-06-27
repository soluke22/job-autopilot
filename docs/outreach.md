# Archived Outreach

Normal Job Radar workflows do not send emails, create Gmail drafts, message recruiters, or send LinkedIn invitations.

Archived Gmail draft workflows require:

```powershell
--i-understand-this-will-create-gmail-drafts
```

Archived LinkedIn recruiter messaging requires:

```powershell
--i-understand-this-will-message-recruiters
```

Examples:

```powershell
npm run archive:createOutreachDrafts -- --i-understand-this-will-create-gmail-drafts
npm run archive:draftEmails -- --i-understand-this-will-create-gmail-drafts
npm run archive:recruiterOutreach -- --i-understand-this-will-message-recruiters
```

Do not run archived outreach commands unless Solomon explicitly approves a separate future workflow.
