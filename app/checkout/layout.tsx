import { createServerClient } from '@/lib/supabase/server';
import { ShopNav } from '@/components/shop/ShopNav';
import { getCartCount } from '@/app/actions/cart';

export default async function CheckoutLayout({ children }: { children: React.ReactNode }) {
  let isLoggedIn = false;
  let cartCount = 0;

  try {
    const supabase = createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    isLoggedIn = !!user;
    if (user) {
      cartCount = await getCartCount();
    }
  } catch {}

  return (
    <div className="min-h-screen bg-background">
      <ShopNav isLoggedIn={isLoggedIn} initialCartCount={cartCount} />
      <main>{children}</main>
    </div>
  );
}
