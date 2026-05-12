import { createServerClient } from '@/lib/supabase/server';
import { getAuthAndWorkspace } from '@/lib/workspace';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient();
    const { ownerId } = await getAuthAndWorkspace(supabase);

    if (!ownerId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { data, error } = await supabase
      .from('categories')
      .select('id, name')
      .eq('user_id', ownerId)
      .order('name');

    if (error) {
      throw error;
    }

    return NextResponse.json({
      categories: data || [],
    });
  } catch (error) {
    console.error('Failed to fetch categories:', error);
    return NextResponse.json(
      { error: 'Failed to fetch categories' },
      { status: 500 }
    );
  }
}
