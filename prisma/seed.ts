/**
 * 數據庫種子腳本
 * 
 * 此腳本生成 3 個預設產業的完整規格結構數據：
 * 1. 服飾產業
 * 2. 3C 電子產品產業
 * 3. 傢俱產業
 * 
 * 執行方式：
 * - Supabase: 使用 Supabase SQL Editor 或 Migration
 * - 或使用: npx tsx prisma/seed.ts
 */

import { SpecData } from '../lib/validations/spec';

/**
 * 種子數據：3 個產業的完整規格模板
 */
export const seedSpecTemplates: Array<{
  name: string;
  description: string;
  category: string;
  template_schema: SpecData;
  is_public: boolean;
}> = [
  // ============================================
  // 1. 服飾產業模板
  // ============================================
  {
    name: '服飾產品規格模板',
    description: '適用於服裝、配件等時尚產品的標準規格模板',
    category: '服飾',
    is_public: true,
    template_schema: {
      version: '1.0.0',
      fields: {
        product_name: {
          key: 'product_name',
          label: '產品名稱',
          type: 'text',
          value: '',
          required: true,
          description: '產品完整名稱',
          placeholder: '例如：純棉 T 恤',
        },
        brand: {
          key: 'brand',
          label: '品牌',
          type: 'select',
          value: '',
          required: true,
          options: ['無印良品', 'UNIQLO', 'ZARA', 'H&M', 'Nike', 'Adidas', '其他'],
          description: '產品品牌',
        },
        category: {
          key: 'category',
          label: '分類',
          type: 'select',
          value: '',
          required: true,
          options: ['上衣', '下裝', '外套', '內衣', '配件', '鞋類', '其他'],
          description: '產品分類',
        },
        gender: {
          key: 'gender',
          label: '性別',
          type: 'select',
          value: '',
          required: true,
          options: ['男', '女', '中性', '童裝'],
          description: '目標性別',
        },
        color: {
          key: 'color',
          label: '顏色',
          type: 'select',
          value: '',
          required: true,
          options: ['黑色', '白色', '灰色', '藍色', '紅色', '綠色', '黃色', '粉色', '其他'],
          description: '產品顏色',
        },
        size: {
          key: 'size',
          label: '尺寸',
          type: 'select',
          value: '',
          required: true,
          options: ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'Free Size'],
          description: '產品尺寸',
        },
        sizes_available: {
          key: 'sizes_available',
          label: '可選尺寸',
          type: 'multiselect',
          value: [],
          required: false,
          options: ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'Free Size'],
          description: '所有可選尺寸',
        },
        material: {
          key: 'material',
          label: '材質',
          type: 'select',
          value: '',
          required: true,
          options: ['純棉', '聚酯纖維', '混紡', '絲質', '羊毛', '亞麻', '其他'],
          description: '產品材質',
        },
        material_composition: {
          key: 'material_composition',
          label: '材質成分',
          type: 'object',
          value: {
            cotton: 0,
            polyester: 0,
            other: 0,
          },
          required: false,
          description: '材質成分百分比',
        },
        price: {
          key: 'price',
          label: '價格',
          type: 'number',
          value: 0,
          required: true,
          description: '產品售價（新台幣）',
          validation: {
            min: 0,
          },
        },
        original_price: {
          key: 'original_price',
          label: '原價',
          type: 'number',
          value: 0,
          required: false,
          description: '原價（如有折扣）',
          validation: {
            min: 0,
          },
        },
        in_stock: {
          key: 'in_stock',
          label: '現貨供應',
          type: 'boolean',
          value: true,
          required: true,
          description: '是否為現貨',
        },
        care_instructions: {
          key: 'care_instructions',
          label: '洗滌說明',
          type: 'multiselect',
          value: [],
          required: false,
          options: ['可機洗', '手洗', '不可漂白', '低溫熨燙', '不可烘乾', '乾洗'],
          description: '洗滌保養說明',
        },
      },
      tags: ['服飾', '時尚'],
      metadata: {
        industry: 'fashion',
        template_version: '1.0.0',
      },
    },
  },

  // ============================================
  // 2. 3C 電子產品產業模板
  // ============================================
  {
    name: '3C 電子產品規格模板',
    description: '適用於手機、電腦、相機等電子產品的標準規格模板',
    category: '3C',
    is_public: true,
    template_schema: {
      version: '1.0.0',
      fields: {
        product_name: {
          key: 'product_name',
          label: '產品名稱',
          type: 'text',
          value: '',
          required: true,
          description: '產品完整名稱',
          placeholder: '例如：iPhone 15 Pro',
        },
        brand: {
          key: 'brand',
          label: '品牌',
          type: 'select',
          value: '',
          required: true,
          options: ['Apple', 'Samsung', 'Google', 'Xiaomi', 'Sony', 'ASUS', 'Acer', '其他'],
          description: '產品品牌',
        },
        category: {
          key: 'category',
          label: '分類',
          type: 'select',
          value: '',
          required: true,
          options: ['手機', '筆記本電腦', '平板電腦', '相機', '耳機', '智慧手錶', '其他'],
          description: '產品分類',
        },
        model: {
          key: 'model',
          label: '型號',
          type: 'text',
          value: '',
          required: true,
          description: '產品型號',
          placeholder: '例如：A2847',
        },
        color: {
          key: 'color',
          label: '顏色',
          type: 'select',
          value: '',
          required: true,
          options: ['黑色', '白色', '銀色', '金色', '藍色', '紅色', '其他'],
          description: '產品顏色',
        },
        storage: {
          key: 'storage',
          label: '儲存空間',
          type: 'select',
          value: '',
          required: true,
          options: ['64GB', '128GB', '256GB', '512GB', '1TB', '2TB'],
          description: '內建儲存容量',
        },
        specifications: {
          key: 'specifications',
          label: '技術規格',
          type: 'object',
          value: {
            processor: '',
            ram: '',
            display: '',
            camera: '',
            battery: '',
            os: '',
          },
          required: false,
          description: '詳細技術規格',
        },
        price: {
          key: 'price',
          label: '價格',
          type: 'number',
          value: 0,
          required: true,
          description: '產品售價（新台幣）',
          validation: {
            min: 0,
          },
        },
        warranty: {
          key: 'warranty',
          label: '保固期',
          type: 'select',
          value: '',
          required: false,
          options: ['無保固', '3個月', '6個月', '1年', '2年', '3年'],
          description: '產品保固期限',
        },
        in_stock: {
          key: 'in_stock',
          label: '現貨供應',
          type: 'boolean',
          value: true,
          required: true,
          description: '是否為現貨',
        },
        features: {
          key: 'features',
          label: '特色功能',
          type: 'multiselect',
          value: [],
          required: false,
          options: ['5G', '無線充電', '防水', '指紋辨識', '臉部辨識', 'NFC', '快充'],
          description: '產品特色功能',
        },
      },
      tags: ['3C', '電子產品'],
      metadata: {
        industry: 'electronics',
        template_version: '1.0.0',
      },
    },
  },

  // ============================================
  // 3. 傢俱產業模板
  // ============================================
  {
    name: '傢俱產品規格模板',
    description: '適用於桌椅、沙發、床組等傢俱產品的標準規格模板',
    category: '傢俱',
    is_public: true,
    template_schema: {
      version: '1.0.0',
      fields: {
        product_name: {
          key: 'product_name',
          label: '產品名稱',
          type: 'text',
          value: '',
          required: true,
          description: '產品完整名稱',
          placeholder: '例如：北歐簡約實木餐桌',
        },
        brand: {
          key: 'brand',
          label: '品牌',
          type: 'select',
          value: '',
          required: false,
          options: ['IKEA', '無印良品', 'HOLA', '特力屋', '其他'],
          description: '產品品牌',
        },
        category: {
          key: 'category',
          label: '分類',
          type: 'select',
          value: '',
          required: true,
          options: ['桌子', '椅子', '沙發', '床組', '櫃子', '書架', '其他'],
          description: '產品分類',
        },
        material: {
          key: 'material',
          label: '材質',
          type: 'select',
          value: '',
          required: true,
          options: ['實木', '人造板', '金屬', '玻璃', '塑膠', '混合材質'],
          description: '主要材質',
        },
        wood_type: {
          key: 'wood_type',
          label: '木材種類',
          type: 'select',
          value: '',
          required: false,
          options: ['橡木', '松木', '胡桃木', '櫻桃木', '白蠟木', '其他'],
          description: '木材種類（如為實木）',
        },
        dimensions: {
          key: 'dimensions',
          label: '尺寸規格',
          type: 'object',
          value: {
            length: 0,
            width: 0,
            height: 0,
            unit: 'cm',
          },
          required: true,
          description: '產品尺寸（長 x 寬 x 高）',
        },
        color: {
          key: 'color',
          label: '顏色',
          type: 'select',
          value: '',
          required: true,
          options: ['原木色', '白色', '黑色', '深棕色', '淺棕色', '其他'],
          description: '產品顏色',
        },
        style: {
          key: 'style',
          label: '風格',
          type: 'select',
          value: '',
          required: false,
          options: ['現代', '北歐', '工業風', '日式', '美式', '中式', '其他'],
          description: '設計風格',
        },
        price: {
          key: 'price',
          label: '價格',
          type: 'number',
          value: 0,
          required: true,
          description: '產品售價（新台幣）',
          validation: {
            min: 0,
          },
        },
        assembly_required: {
          key: 'assembly_required',
          label: '需組裝',
          type: 'boolean',
          value: false,
          required: false,
          description: '是否需要自行組裝',
        },
        weight: {
          key: 'weight',
          label: '重量',
          type: 'number',
          value: 0,
          required: false,
          description: '產品重量（公斤）',
          validation: {
            min: 0,
          },
        },
        max_load: {
          key: 'max_load',
          label: '最大承重',
          type: 'number',
          value: 0,
          required: false,
          description: '最大承重（公斤）',
          validation: {
            min: 0,
          },
        },
        in_stock: {
          key: 'in_stock',
          label: '現貨供應',
          type: 'boolean',
          value: true,
          required: true,
          description: '是否為現貨',
        },
      },
      tags: ['傢俱', '居家'],
      metadata: {
        industry: 'furniture',
        template_version: '1.0.0',
      },
    },
  },
];

/**
 * 示例規格數據（用於展示）
 */
export const seedExampleSpecifications: Array<{
  title: string;
  description: string;
  category: string;
  spec_data: SpecData;
  tags: string[];
}> = [
  {
    title: 'iPhone 15 Pro 256GB 深藍色',
    description: 'Apple iPhone 15 Pro 智慧型手機，256GB 儲存空間',
    category: '3C',
    tags: ['3C', '手機', 'Apple', 'iPhone'],
    spec_data: {
      version: '1.0.0',
      fields: {
        product_name: {
          key: 'product_name',
          label: '產品名稱',
          type: 'text',
          value: 'iPhone 15 Pro',
          required: true,
        },
        brand: {
          key: 'brand',
          label: '品牌',
          type: 'select',
          value: 'Apple',
          required: true,
          options: ['Apple', 'Samsung', 'Google', 'Xiaomi', '其他'],
        },
        color: {
          key: 'color',
          label: '顏色',
          type: 'select',
          value: '深藍色',
          required: true,
          options: ['深藍色', '原色鈦金屬', '白色鈦金屬', '黑色鈦金屬'],
        },
        storage: {
          key: 'storage',
          label: '儲存空間',
          type: 'select',
          value: '256GB',
          required: true,
          options: ['128GB', '256GB', '512GB', '1TB'],
        },
        price: {
          key: 'price',
          label: '價格',
          type: 'number',
          value: 35900,
          required: true,
          validation: { min: 0 },
        },
        in_stock: {
          key: 'in_stock',
          label: '現貨供應',
          type: 'boolean',
          value: true,
          required: true,
        },
      },
    },
  },
  {
    title: '純棉 T 恤 黑色 L',
    description: '基本款純棉 T 恤，舒適透氣',
    category: '服飾',
    tags: ['服飾', '上衣', 'T 恤'],
    spec_data: {
      version: '1.0.0',
      fields: {
        product_name: {
          key: 'product_name',
          label: '產品名稱',
          type: 'text',
          value: '純棉 T 恤',
          required: true,
        },
        color: {
          key: 'color',
          label: '顏色',
          type: 'select',
          value: '黑色',
          required: true,
          options: ['黑色', '白色', '灰色', '藍色'],
        },
        size: {
          key: 'size',
          label: '尺寸',
          type: 'select',
          value: 'L',
          required: true,
          options: ['S', 'M', 'L', 'XL'],
        },
        material: {
          key: 'material',
          label: '材質',
          type: 'select',
          value: '純棉',
          required: true,
          options: ['純棉', '聚酯纖維', '混紡'],
        },
        price: {
          key: 'price',
          label: '價格',
          type: 'number',
          value: 590,
          required: true,
          validation: { min: 0 },
        },
        in_stock: {
          key: 'in_stock',
          label: '現貨供應',
          type: 'boolean',
          value: true,
          required: true,
        },
      },
    },
  },
];

/**
 * Supabase 種子腳本執行函數
 * 
 * 使用方式：
 * 1. 在 Supabase Dashboard 的 SQL Editor 中執行生成的 SQL
 * 2. 或使用 Supabase Client 在應用中執行
 */
export async function seedSupabase(supabaseClient: any) {
  console.log('開始種子數據導入...');

  try {
    // 插入模板數據
    for (const template of seedSpecTemplates) {
      const { data, error } = await supabaseClient
        .from('spec_templates')
        .insert({
          name: template.name,
          description: template.description,
          category: template.category,
          template_schema: template.template_schema,
          is_public: template.is_public,
        })
        .select();

      if (error) {
        console.error(`插入模板失敗: ${template.name}`, error);
      } else {
        console.log(`✅ 已插入模板: ${template.name}`);
      }
    }

    console.log('✅ 種子數據導入完成！');
  } catch (error) {
    console.error('❌ 種子數據導入失敗:', error);
    throw error;
  }
}

/**
 * 生成 SQL 插入語句（用於 Supabase SQL Editor）
 */
export function generateSeedSQL(): string {
  const sqlStatements = seedSpecTemplates.map((template) => {
    const templateSchemaJson = JSON.stringify(template.template_schema).replace(/'/g, "''");
    return `
INSERT INTO spec_templates (name, description, category, template_schema, is_public)
VALUES (
  '${template.name.replace(/'/g, "''")}',
  '${template.description.replace(/'/g, "''")}',
  '${template.category}',
  '${templateSchemaJson}'::jsonb,
  ${template.is_public}
);`;
  });

  return `
-- 種子數據：規格模板
-- 執行時間: ${new Date().toISOString()}

${sqlStatements.join('\n')}

-- 驗證插入結果
SELECT name, category, is_public FROM spec_templates WHERE is_public = true;
`;
}

// 如果直接執行此文件
if (require.main === module) {
  console.log('生成 SQL 種子腳本...\n');
  console.log(generateSeedSQL());
}
