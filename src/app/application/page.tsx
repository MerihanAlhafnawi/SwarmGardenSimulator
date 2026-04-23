import SwarmApplication from "@/components/SwarmApplication";

export default async function ApplicationPage({
  searchParams,
}: {
  searchParams: Promise<{ tour?: string }>;
}) {
  const params = await searchParams;

  return <SwarmApplication forceTour={params.tour === "1"} />;
}
