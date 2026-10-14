import type { NetworkId } from "@/components/connector/SocialIcon";

export const BASE = "/connector";
export const APP = "/connector/app";

export type MenuLink = { label: string; href: string; icon: string; desc?: string };

/* ---------------------------------------------------------------- */
/* Products (top strip + Platform menu)                               */
/* ---------------------------------------------------------------- */

export const products: MenuLink[] = [
  { label: "Social Media", href: BASE, icon: "gear", desc: "Manage social media at scale effortlessly." },
  { label: "Reviews", href: `${BASE}/reviews`, icon: "star", desc: "Improve your star ratings on every listing." },
  { label: "MCP Server", href: `${BASE}/features/mcp-server`, icon: "plug", desc: "Automate social workflows from any AI agent." },
  { label: "Listings", href: `${BASE}/listings`, icon: "globeSearch", desc: "Create and manage your online listings." },
];

/* ---------------------------------------------------------------- */
/* Features                                                           */
/* ---------------------------------------------------------------- */

export type Feature = {
  slug: string;
  label: string;
  icon: string;
  group: "Capabilities" | "Core features" | "Top features";
  tagline: string;
  points: string[];
  appHref?: string;
};

export const features: Feature[] = [
  { slug: "publishing-scheduling", label: "Publishing and Scheduling", icon: "send", group: "Capabilities", tagline: "Plan once, publish everywhere — at the exact minute your audience is online.", points: ["Schedule to 11 networks from one composer", "Per-network captions, first comments and media", "Queue slots and best-time suggestions", "Recurring and evergreen posts"], appHref: `${APP}/posts` },
  { slug: "analytics-reporting", label: "Analytics and Reporting", icon: "analytics", group: "Capabilities", tagline: "Know what works with clean, client-ready analytics for every channel.", points: ["Per-network dashboards", "Audience growth and engagement trends", "Top posts and best time to post", "White-label PDF exports"], appHref: `${APP}/reports` },
  { slug: "review-generation", label: "Review Generation", icon: "starPlus", group: "Capabilities", tagline: "Ask happy customers for reviews over WhatsApp, SMS and email.", points: ["Templates for every channel", "Smart gating to private feedback", "QR codes for in-store asks", "Automated follow-ups"], appHref: `${APP}/inbox` },
  { slug: "engagement", label: "Engagement", icon: "chat", group: "Capabilities", tagline: "Reply to comments, DMs and reviews from one unified inbox.", points: ["Unified social inbox", "Saved replies", "Assign conversations to teammates", "Sentiment labels"], appHref: `${APP}/inbox` },
  { slug: "collaboration", label: "Collaboration", icon: "userPlus", group: "Capabilities", tagline: "Bring teammates and clients into one approval workflow.", points: ["Roles and permissions", "Content contribution from clients", "Comments on drafts", "Activity log"], appHref: `${APP}/posts/contribution` },
  { slug: "white-label", label: "White Label", icon: "palette", group: "Capabilities", tagline: "Put your agency's brand on the dashboard, reports and emails.", points: ["Custom domain", "Your logo and colours", "Branded reports", "Client-facing login page"] },
  { slug: "social-media-calendar", label: "Social Media Calendar", icon: "calendar", group: "Core features", tagline: "See every scheduled post across every brand on one calendar.", points: ["Day, week and month views", "Drag to reschedule", "Holiday and notes overlay", "Filter by account, tag or author"], appHref: `${APP}/posts/calendar` },
  { slug: "advanced-reports", label: "Advanced Reports", icon: "report", group: "Core features", tagline: "Build multi-network reports and email them on a schedule.", points: ["Drag-and-drop report builder", "Scheduled delivery", "Competitor benchmarks", "Shareable links"], appHref: `${APP}/reports` },
  { slug: "bulk-import", label: "Bulk Import", icon: "layers", group: "Core features", tagline: "Upload a CSV and schedule hundreds of posts in one go.", points: ["CSV with media URLs", "Validation before scheduling", "Map columns to accounts", "Error report per row"], appHref: `${APP}/posts/bulkimport` },
  { slug: "content-library", label: "Content Library", icon: "library", group: "Core features", tagline: "Keep captions, images and videos ready to reuse.", points: ["Folders and tags", "Search across assets", "One-click add to composer", "Shared team library"], appHref: `${APP}/library` },
  { slug: "team-management", label: "Team Management", icon: "users", group: "Core features", tagline: "Invite your team and control who can publish where.", points: ["Granular roles", "Per-account access", "Approval chains", "Seat management"] },
  { slug: "ai-pilot", label: "AI Pilot", icon: "sparkles", group: "Core features", tagline: "Generate on-brand captions, hashtags and ideas in seconds.", points: ["Brand tone presets", "Platform-aware length", "Hashtag suggestions", "Holiday-based ideas"], appHref: `${APP}/posts` },
  { slug: "ai-scheduler", label: "AI Scheduler", icon: "robot", group: "Top features", tagline: "Let AI pick the best slot for every post on every network.", points: ["Learns from your engagement", "Avoids queue collisions", "Timezone aware", "One-click accept"] },
  { slug: "approvals", label: "Approvals On-the-Go", icon: "checkCircle", group: "Top features", tagline: "Clients approve posts from email or mobile — no login needed.", points: ["Magic-link approvals", "Comment and request changes", "Approval history", "Auto-publish on approve"] },
  { slug: "review-management", label: "Review Management", icon: "star", group: "Top features", tagline: "Monitor and reply to reviews from Google and Facebook in one feed.", points: ["Unified reviews feed", "AI-drafted replies", "Rating alerts", "Location filters"] },
  { slug: "review-marketing", label: "Review Marketing", icon: "megaphone", group: "Top features", tagline: "Turn 5-star reviews into ready-to-post social graphics.", points: ["Review-to-post templates", "Website widgets", "Brand colours applied", "Schedule straight to queue"] },
  { slug: "browser-extension", label: "Browser Extension", icon: "puzzle", group: "Top features", tagline: "Share any web page to your queue without leaving the tab.", points: ["Chrome and Edge", "Pick image from page", "Choose accounts", "Add to queue or schedule"] },
  { slug: "content-bank", label: "Content Bank", icon: "building", group: "Top features", tagline: "Curated, ready-to-post content for every industry.", points: ["Industry packs", "Seasonal collections", "Editable captions", "Licensed images"], appHref: `${APP}/templates` },
  { slug: "mcp-server", label: "MCP Server", icon: "plug", group: "Top features", tagline: "Let AI agents draft, schedule and report through a secure MCP endpoint.", points: ["Works with Claude and other MCP clients", "Scoped API tokens", "Draft, schedule and analytics tools", "Audit log for every action"] },
];

export const featureGroups = ["Capabilities", "Core features", "Top features"] as const;

export const platformExtras: MenuLink[] = [
  { label: "All Features", href: `${BASE}/features`, icon: "list" },
  { label: "Latest Feature Releases", href: `${BASE}/resources/whats-new`, icon: "refresh" },
  { label: "Integrations", href: `${BASE}/features/mcp-server`, icon: "puzzle" },
];

/* ---------------------------------------------------------------- */
/* Solutions                                                          */
/* ---------------------------------------------------------------- */

export type Solution = { slug: string; label: string; icon: string; desc: string; kind: "audience" | "industry" };

export const solutions: Solution[] = [
  { slug: "agencies", label: "Agency", icon: "megaphone", desc: "Manage 100+ social media accounts effortlessly.", kind: "audience" },
  { slug: "brands", label: "Brands", icon: "crown", desc: "Generate a high ROI with automation.", kind: "audience" },
  { slug: "multi-location", label: "Multi-Location Brands", icon: "pin", desc: "Onboard and market local businesses quickly.", kind: "audience" },
  { slug: "saas", label: "SaaS Tools", icon: "sliders", desc: "Add social media capabilities to your product.", kind: "audience" },
  { slug: "real-estate", label: "Real Estate", icon: "home", desc: "Showcase listings and open houses.", kind: "industry" },
  { slug: "plumber", label: "Plumber", icon: "faucet", desc: "Win local jobs with steady posting.", kind: "industry" },
  { slug: "doctor", label: "Doctor", icon: "stethoscope", desc: "Share health tips and clinic updates.", kind: "industry" },
  { slug: "restaurant", label: "Restaurant", icon: "utensils", desc: "Fill tables with menu drops and offers.", kind: "industry" },
  { slug: "law", label: "Law", icon: "scale", desc: "Build trust with thought leadership.", kind: "industry" },
  { slug: "photography", label: "Photography", icon: "camera", desc: "Turn your portfolio into bookings.", kind: "industry" },
  { slug: "hvac", label: "HVAC", icon: "snowflake", desc: "Seasonal reminders that bring calls.", kind: "industry" },
  { slug: "non-profit", label: "Non Profit", icon: "handHeart", desc: "Rally donors and volunteers.", kind: "industry" },
  { slug: "handyman", label: "Handyman", icon: "wrench", desc: "Before-and-afters that sell.", kind: "industry" },
  { slug: "e-commerce", label: "E-Commerce", icon: "cart", desc: "Drive product launches and sales.", kind: "industry" },
];

export const platformNetworks: NetworkId[] = [
  "facebook",
  "instagram",
  "tiktok",
  "x",
  "linkedin",
  "threads",
  "bluesky",
  "youtube",
  "pinterest",
  "google",
];

/* ---------------------------------------------------------------- */
/* Resources                                                          */
/* ---------------------------------------------------------------- */

export const resources: MenuLink[] = [
  { label: "Blog", href: `${BASE}/resources/blog`, icon: "edit", desc: "All you need to know about social media marketing" },
  { label: "Holiday Calendar", href: `${BASE}/resources/holiday-calendar`, icon: "calendarCheck", desc: "Plan your posts in advance with the holiday calendar" },
  { label: "Agency Success Guide", href: `${BASE}/resources/agency-guide`, icon: "book", desc: "Expert advice for agency growth" },
  { label: "Webinars", href: `${BASE}/webinars`, icon: "presentation", desc: "Stay up to date with on-demand webinars" },
  { label: "Templates", href: `${BASE}/resources/templates`, icon: "layout", desc: "Multiple options to choose from" },
  { label: "Podcasts", href: `${BASE}/resources/podcasts`, icon: "mic", desc: "Latest podcasts with tips and tricks" },
  { label: "Downloadables", href: `${BASE}/resources/downloadables`, icon: "download", desc: "A free resource hub for marketers" },
  { label: "Help Center", href: `${BASE}/help`, icon: "help", desc: "Your guide to mastering Social Media Connector" },
  { label: "Newsroom", href: `${BASE}/resources/newsroom`, icon: "newspaper", desc: "Social Media Connector in the news" },
  { label: "Master Class", href: `${BASE}/resources/master-class`, icon: "cap", desc: "Free marketing courses to upskill yourself" },
  { label: "Free Tools", href: `${BASE}/resources/free-tools`, icon: "gear", desc: "Productivity-enhancing tools for marketers" },
  { label: "Social Media Terms", href: `${BASE}/resources/glossary`, icon: "sortAZ", desc: "Your digital communication lingo guide" },
];

export type ResourceItem = { title: string; meta: string; body: string };

export const resourceContent: Record<string, { title: string; intro: string; items: ResourceItem[] }> = {
  blog: {
    title: "Blog",
    intro: "Practical playbooks on social media marketing, written by people who run accounts every day.",
    items: [
      { title: "The 2026 guide to posting frequency on every network", meta: "8 min read · Strategy", body: "How often to post on Instagram, LinkedIn, TikTok and more — with data from 40,000 accounts." },
      { title: "How agencies onboard a new client in under a day", meta: "6 min read · Agencies", body: "A checklist covering access, brand kit, content calendar and reporting cadence." },
      { title: "Writing captions with AI without sounding like AI", meta: "5 min read · AI", body: "Prompts, brand tone presets and the edits that keep captions human." },
      { title: "Google Business Profile posts: the overlooked local channel", meta: "7 min read · Local", body: "Why local businesses should post weekly to Google, and what to post." },
      { title: "Bulk scheduling: a CSV template that never fails", meta: "4 min read · Workflow", body: "Columns, date formats and media URLs that import cleanly the first time." },
      { title: "Reading your analytics: five numbers that matter", meta: "6 min read · Analytics", body: "Reach, engagement rate, saves, profile visits and link clicks — explained." },
    ],
  },
  "holiday-calendar": {
    title: "Holiday Calendar",
    intro: "Every observance worth posting about, so your calendar is never empty.",
    items: [
      { title: "Diwali", meta: "November · Festival", body: "Lights, sweets and family — share offers and greetings." },
      { title: "World Mental Health Day", meta: "10 October · Awareness", body: "Support-focused posts and resources for your community." },
      { title: "Black Friday", meta: "Late November · Retail", body: "Countdown posts, early-access and last-call reminders." },
      { title: "Christmas", meta: "25 December · Festival", body: "Gift guides, behind-the-scenes and thank-you posts." },
      { title: "New Year", meta: "1 January · Global", body: "Recaps, goals and fresh-start campaigns." },
      { title: "Valentine's Day", meta: "14 February · Global", body: "Couples, self-love and customer-love posts." },
    ],
  },
  "agency-guide": {
    title: "Agency Success Guide",
    intro: "Expert advice for growing a social media agency from 5 to 500 clients.",
    items: [
      { title: "Pricing your retainers", meta: "Chapter 1", body: "Package by outcomes, not post counts." },
      { title: "Building a repeatable onboarding", meta: "Chapter 2", body: "Forms, access requests and the first 30 days." },
      { title: "Approvals that don't stall", meta: "Chapter 3", body: "Set deadlines and use magic-link approvals." },
      { title: "Reporting clients actually read", meta: "Chapter 4", body: "One page, three insights, one recommendation." },
    ],
  },
  templates: {
    title: "Templates",
    intro: "Ready-made calendars, report layouts and caption formulas.",
    items: [
      { title: "Monthly content calendar", meta: "Sheet", body: "A 30-day plan with content pillars and slots." },
      { title: "Client report", meta: "Report", body: "White-label report layout with the essential KPIs." },
      { title: "Caption formulas", meta: "Doc", body: "Hook, value, call to action — 25 variations." },
      { title: "Bulk import CSV", meta: "CSV", body: "The exact columns the bulk importer expects." },
    ],
  },
  podcasts: {
    title: "Podcasts",
    intro: "Conversations with marketers, creators and agency founders.",
    items: [
      { title: "Ep. 42 — Scaling a local agency", meta: "38 min", body: "From freelancer to a 12-person team." },
      { title: "Ep. 41 — Short video that converts", meta: "31 min", body: "Hooks, pacing and captions for Reels and Shorts." },
      { title: "Ep. 40 — Reviews are the new ads", meta: "27 min", body: "Why star ratings drive local search." },
    ],
  },
  downloadables: {
    title: "Downloadables",
    intro: "Free e-books, checklists and toolkits for marketers.",
    items: [
      { title: "Social media audit checklist", meta: "PDF · 6 pages", body: "Audit any brand's presence in an hour." },
      { title: "Hashtag research workbook", meta: "PDF · 12 pages", body: "Find, group and rotate hashtags." },
      { title: "Crisis response playbook", meta: "PDF · 9 pages", body: "What to post — and not post — when things go wrong." },
    ],
  },
  newsroom: {
    title: "Newsroom",
    intro: "Announcements and press coverage.",
    items: [
      { title: "Social Media Connector launches MCP Server", meta: "Press release", body: "AI agents can now draft, schedule and report on social content." },
      { title: "Listings now syncs to 40+ directories", meta: "Product news", body: "Keep store hours and addresses accurate everywhere." },
    ],
  },
  "master-class": {
    title: "Master Class",
    intro: "Free courses to upskill yourself and your team.",
    items: [
      { title: "Social media strategy 101", meta: "6 lessons", body: "Goals, audiences, pillars and calendars." },
      { title: "Analytics for marketers", meta: "5 lessons", body: "Read, explain and act on your numbers." },
      { title: "Running an agency", meta: "8 lessons", body: "Sales, delivery and retention." },
    ],
  },
  "free-tools": {
    title: "Free Tools",
    intro: "Small utilities that save marketers time.",
    items: [
      { title: "Caption generator", meta: "AI", body: "Generate three caption options from a single idea." },
      { title: "Hashtag generator", meta: "AI", body: "Relevant hashtags grouped by reach." },
      { title: "UTM builder", meta: "Utility", body: "Build tracked links for every campaign." },
      { title: "Image resizer", meta: "Utility", body: "Resize one image for every network." },
    ],
  },
  glossary: {
    title: "Social Media Terms",
    intro: "Your digital communication lingo guide.",
    items: [
      { title: "Engagement rate", meta: "Metric", body: "Interactions divided by reach or followers." },
      { title: "Reach vs impressions", meta: "Metric", body: "Unique viewers vs total views." },
      { title: "UGC", meta: "Content", body: "User-generated content created by customers." },
      { title: "Evergreen content", meta: "Content", body: "Posts that stay relevant and can be re-queued." },
      { title: "Dark social", meta: "Concept", body: "Shares through private channels like DMs." },
    ],
  },
  "whats-new": {
    title: "Latest Feature Releases",
    intro: "Everything we shipped recently.",
    items: [
      { title: "MCP Server", meta: "October 2026", body: "Connect AI agents to draft and schedule posts." },
      { title: "Bluesky analytics", meta: "September 2026", body: "Followers, reposts and likes per post." },
      { title: "Review QR codes", meta: "August 2026", body: "Print a code that opens your review form." },
      { title: "Calendar notes", meta: "July 2026", body: "Pin campaign notes to any day." },
    ],
  },
};

/* ---------------------------------------------------------------- */
/* Pricing                                                            */
/* ---------------------------------------------------------------- */

export type Plan = {
  name: string;
  monthly: number;
  annual: number;
  blurb: string;
  popular?: boolean;
  limits: string[];
  features: string[];
};

export const socialPlans: Plan[] = [
  { name: "Essentials", monthly: 1499, annual: 1199, blurb: "For solo marketers and creators.", limits: ["1 user", "7 social accounts", "500 scheduled posts"], features: ["Calendar & queue", "AI Pilot (50 credits)", "Basic analytics", "Bulk import"] },
  { name: "Standard", monthly: 2999, annual: 2399, blurb: "For growing brands and small teams.", popular: true, limits: ["3 users", "20 social accounts", "Unlimited posts"], features: ["Everything in Essentials", "Content library", "Advanced reports", "Unified inbox", "Approvals"] },
  { name: "Premium", monthly: 4999, annual: 3999, blurb: "For agencies managing many clients.", limits: ["6 users", "50 social accounts", "Unlimited posts"], features: ["Everything in Standard", "Client management", "White-label reports", "Competitor analysis", "Priority support"] },
  { name: "Ultimate", monthly: 8999, annual: 7199, blurb: "For large agencies and enterprises.", limits: ["Unlimited users", "100 social accounts", "Unlimited posts"], features: ["Everything in Premium", "Full white label", "MCP Server access", "Dedicated manager", "SSO"] },
];

export const listingPlans: Plan[] = [
  { name: "Starter", monthly: 999, annual: 799, blurb: "One location, essential directories.", limits: ["1 location", "20 directories"], features: ["Listing sync", "Review monitoring", "Monthly report"] },
  { name: "Growth", monthly: 1999, annual: 1599, blurb: "Small chains and franchises.", popular: true, limits: ["5 locations", "40+ directories"], features: ["Everything in Starter", "Review generation", "AI replies", "WhatsApp & SMS asks"] },
  { name: "Scale", monthly: 3999, annual: 3199, blurb: "Multi-location brands.", limits: ["25 locations", "40+ directories"], features: ["Everything in Growth", "Location groups", "API access", "Dedicated manager"] },
];

export const faqs = [
  { q: "Can I try Social Media Connector for free?", a: "Yes. Every plan starts with a 14-day free trial — no card required, cancel any time." },
  { q: "Which networks can I connect?", a: "Facebook, Instagram, X, LinkedIn, TikTok, YouTube, Pinterest, Threads, Bluesky and Google Business Profile." },
  { q: "Can my clients approve posts?", a: "Yes. Send a magic link — clients can approve, comment or request changes without creating an account." },
  { q: "Is there a money-back guarantee?", a: "Annual plans include a 30-day money-back guarantee." },
  { q: "Do you offer white label?", a: "Premium includes white-label reports; Ultimate unlocks a fully white-labelled dashboard on your own domain." },
];

/* ---------------------------------------------------------------- */
/* Social proof                                                       */
/* ---------------------------------------------------------------- */

export const testimonials = [
  { name: "Ananya R.", role: "Founder, Pixel & Pine Studio", quote: "We moved 60 client accounts in a weekend. Approvals alone saved us a full day every week.", rating: 5 },
  { name: "Marco D.", role: "Social Lead, UrbanBite", quote: "The calendar finally shows every location's posts in one place. Our local reach doubled.", rating: 5 },
  { name: "Priya S.", role: "Marketing Manager, HealWell Clinics", quote: "Review asks over WhatsApp took us from 3.9 to 4.7 stars in four months.", rating: 5 },
];

export const stats = [
  { value: "11", label: "networks in one composer" },
  { value: "4.8/5", label: "average customer rating" },
  { value: "2M+", label: "posts published monthly" },
  { value: "24/7", label: "human support" },
];

/* ---------------------------------------------------------------- */
/* Videos, webinars, help, case studies                               */
/* ---------------------------------------------------------------- */

/** Set youtubeId to embed a real recording; without one the animated product demo plays. */
export type VideoItem = {
  slug: string;
  title: string;
  duration: string;
  category: string;
  scene: "calendar" | "composer" | "analytics" | "inbox" | "listings";
  youtubeId?: string;
};

export const videos: VideoItem[] = [
  { slug: "overview", title: "Social Media Connector overview", duration: "2:14", category: "Getting started", scene: "calendar" },
  { slug: "connect-accounts", title: "Connect your first social accounts", duration: "1:42", category: "Getting started", scene: "composer" },
  { slug: "create-post", title: "Create and schedule a post", duration: "3:05", category: "Publishing", scene: "composer" },
  { slug: "calendar", title: "Plan with the content calendar", duration: "2:31", category: "Publishing", scene: "calendar" },
  { slug: "bulk", title: "Bulk import posts from CSV", duration: "2:48", category: "Publishing", scene: "composer" },
  { slug: "analytics", title: "Read your analytics dashboard", duration: "4:10", category: "Analytics", scene: "analytics" },
  { slug: "reports", title: "Build a white-label client report", duration: "3:22", category: "Analytics", scene: "analytics" },
  { slug: "inbox", title: "Reply faster with the unified inbox", duration: "2:05", category: "Engagement", scene: "inbox" },
  { slug: "listings", title: "Sync your business listings", duration: "2:40", category: "Listings", scene: "listings" },
];

export const webinars = [
  { title: "Planning a quarter of content in one afternoon", date: "23 Oct 2026", host: "Content team", status: "Upcoming" },
  { title: "Agency reporting that wins renewals", date: "06 Nov 2026", host: "Agency success", status: "Upcoming" },
  { title: "AI captions: prompts that sound like you", date: "18 Sep 2026", host: "Product team", status: "On demand" },
  { title: "Local SEO with reviews and listings", date: "28 Aug 2026", host: "Local growth", status: "On demand" },
  { title: "Short video for small businesses", date: "07 Aug 2026", host: "Creator team", status: "On demand" },
  { title: "Approvals without the chaos", date: "17 Jul 2026", host: "Customer success", status: "On demand" },
];

export const caseStudies = [
  { company: "Pixel & Pine Studio", industry: "Agency", result: "60 clients managed by 4 people", metric: "+38%", metricLabel: "team capacity" },
  { company: "UrbanBite", industry: "Restaurant chain", result: "Local reach doubled across 18 outlets", metric: "2.1×", metricLabel: "local reach" },
  { company: "HealWell Clinics", industry: "Healthcare", result: "Rating rose from 3.9 to 4.7", metric: "+0.8★", metricLabel: "average rating" },
  { company: "Nestly Homes", industry: "Real estate", result: "Open-house posts automated", metric: "11 hrs", metricLabel: "saved weekly" },
];

export const helpCategories = [
  { title: "Getting started", icon: "rocket", articles: ["Create your account", "Connect social accounts", "Invite your team", "Set your timezone"] },
  { title: "Publishing", icon: "send", articles: ["Create a post", "Use queue slots", "Bulk import with CSV", "First comments"] },
  { title: "Calendar", icon: "calendar", articles: ["Calendar views", "Drag to reschedule", "Add notes", "Filter posts"] },
  { title: "Analytics", icon: "analytics", articles: ["Network analytics", "Build a report", "Schedule report emails", "Competitor tracking"] },
  { title: "Engagement", icon: "chat", articles: ["Unified inbox", "Saved replies", "Assign conversations", "Review replies"] },
  { title: "Billing", icon: "dollar", articles: ["Change plan", "Download invoices", "Add seats", "Cancel subscription"] },
];
