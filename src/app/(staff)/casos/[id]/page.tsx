import { redirect } from "next/navigation";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function CasoRedirect({ params }: Props) {
  const { id } = await params;
  redirect(`/expediente/${id}`);
}
