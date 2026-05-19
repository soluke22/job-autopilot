import { loadProfile, Profile } from "./config";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function splitBodyParagraphs(value: string) {
  const parts = value
    .replace(/\r/g, "")
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  return {
    mainParagraph: parts[0] ?? "",
    closingParagraph: parts.slice(1).join("\n\n")
  };
}

export function buildSubject(roleTitle: string) {
  return `Application for ${roleTitle} - Quick Intro`;
}

function buildGreeting(greetingName?: string) {
  return greetingName ? `Hi ${greetingName},` : "Hi [Name],";
}

export function inferGreetingNameFromEmail(email?: string) {
  if (!email) {
    return null;
  }

  const localPart = email.split("@")[0]?.trim().toLowerCase();
  if (!localPart) {
    return null;
  }

  const firstToken = localPart
    .split(/[._-]+/)
    .map((part) => part.replace(/\d+/g, "").trim())
    .find((part) => /^[a-z]{2,}$/.test(part));

  if (!firstToken) {
    return null;
  }

  return firstToken.charAt(0).toUpperCase() + firstToken.slice(1);
}

function buildSignatureName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) {
    return parts[0] ?? fullName;
  }

  return `${parts[0]} ${parts[parts.length - 1][0]}`;
}

function buildSenderLinks(profile: Profile) {
  return [
    profile.linkedin ? { label: "LinkedIn", url: profile.linkedin } : null,
    profile.portfolio ? { label: "Portfolio", url: profile.portfolio } : null,
    profile.github ? { label: "GitHub", url: profile.github } : null
  ].filter((link): link is { label: string; url: string } => Boolean(link));
}

export function buildEmailBody(
  roleTitle: string,
  middleParagraph: string,
  greetingName?: string | null,
  profile: Profile = loadProfile()
) {
  const senderTitle = profile.outreach?.title ?? "Software Engineer";
  const experienceSummary = profile.outreach?.experienceSummary ?? "experience relevant to this role";
  const signatureName = profile.outreach?.signatureName ?? buildSignatureName(profile.fullName);
  const senderLinks = buildSenderLinks(profile);

  const escapedRoleTitle = escapeHtml(roleTitle);
  const escapedFullName = escapeHtml(profile.fullName);
  const escapedSenderTitle = escapeHtml(senderTitle);
  const escapedExperienceSummary = escapeHtml(experienceSummary);
  const { mainParagraph, closingParagraph } = splitBodyParagraphs(middleParagraph);
  const escapedMain = escapeHtml(mainParagraph);
  const escapedClosing = escapeHtml(closingParagraph);
  const greeting = buildGreeting(greetingName ?? undefined);
  const escapedGreeting = escapeHtml(greeting);
  const escapedSignatureName = escapeHtml(signatureName);
  const senderLinksText = senderLinks.map((link) => `${link.label}: ${link.url}`);
  const senderLinksHtml = senderLinks.map(
    (link) => `${escapeHtml(link.label)}: <a href="${escapeHtml(link.url)}">${escapeHtml(link.url)}</a>`
  );

  const bodyText = [
    greeting,
    "",
    "Hope you're doing well.",
    "",
    `I'm ${profile.fullName}, a ${senderTitle} with ${experienceSummary}. I recently applied for the ${roleTitle} role and wanted to reach out directly.`,
    "",
    mainParagraph,
    ...(closingParagraph ? ["", closingParagraph] : []),
    "",
    "Best regards,",
    signatureName,
    "",
    ...senderLinksText
  ].join("\n");

  const bodyHtml = [
    "<div>",
    `<p>${escapedGreeting}</p>`,
    "<p>Hope you're doing well.</p>",
    `<p>I'm <strong>${escapedFullName}</strong>, a ${escapedSenderTitle} with ${escapedExperienceSummary}. I recently applied for the <strong>${escapedRoleTitle}</strong> role and wanted to reach out directly.</p>`,
    `<p>${escapedMain}</p>`,
    ...(closingParagraph ? [`<p>${escapedClosing}</p>`] : []),
    `<p>Best regards,<br><strong>${escapedSignatureName}</strong></p>`,
    ...(senderLinksHtml.length > 0 ? [`<p>${senderLinksHtml.join("<br>")}</p>`] : []),
    "</div>"
  ].join("");

  return { bodyText, bodyHtml };
}
