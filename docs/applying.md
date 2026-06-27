# Archived Apply Automation

Normal Job Radar workflows do not apply to jobs, click final apply buttons, upload resumes, or fill application forms.

The old apply scripts are retained only as archived code. They are not exposed as normal commands and fail unless the explicit flag below is passed:

```powershell
npm run archive:applyBatchWindows -- --i-understand-this-will-apply
npm run archive:applyBatchMac -- --i-understand-this-will-apply
```

Do not run these archived commands unless Solomon explicitly approves a separate future workflow.
