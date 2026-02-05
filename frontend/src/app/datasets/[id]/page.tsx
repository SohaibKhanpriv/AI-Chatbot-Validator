import { api } from "@/lib/api";
import { notFound } from "next/navigation";
import Link from "next/link";
import DatasetDetailClient from "@/components/DatasetDetailClient";

export default async function DatasetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const datasetId = parseInt(id, 10);
  if (Number.isNaN(datasetId)) notFound();
  let dataset;
  try {
    dataset = await api.datasets.get(datasetId);
  } catch {
    notFound();
  }
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/datasets" className="text-[var(--neural-primary)] hover:underline text-sm">
          ← Datasets
        </Link>
      </div>
      <DatasetDetailClient datasetId={datasetId} initialDataset={dataset} />
    </div>
  );
}
