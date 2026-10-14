import AnalyticsView from "@/components/connector/app/AnalyticsView";

/** Pre-render every network so the dashboard also works as a static export. */
export function generateStaticParams() {
  return ["X", "x", "facebook", "instagram", "linkedin", "gmb", "youtube", "tiktok", "pinterest", "threads", "bluesky"].map(
    (network) => ({ network }),
  );
}

export default function AnalyticsPage() {
  return <AnalyticsView />;
}
