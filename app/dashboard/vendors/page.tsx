import { fetchVendors } from '@/app/actions/vendors'
import { VendorsClient } from './VendorsClient'

export default async function VendorsPage({
  searchParams
}: { searchParams: Promise<{ search?: string; page?: string }> }) {
  const resolved = await searchParams
  const page = Number(resolved.page ?? 1)
  const { vendors, total, pageSize } = await fetchVendors({
    search: resolved.search,
    page
  })
  return (
    <VendorsClient
      initialVendors={vendors}
      total={total}
      page={page}
      pageSize={pageSize}
    />
  )
}