import { redirect } from "next/navigation";

export default async function AdminAwardRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/admin/competitions/${id}/bids`);
}
