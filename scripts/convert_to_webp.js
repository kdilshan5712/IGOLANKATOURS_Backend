import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';
import sharp from 'sharp';
import axios from 'axios';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

dotenv.config({ path: 'c:/Users/kdils/OneDrive/Desktop/IGOLANKA/IGOLANKATOURS_Backend/.env' });

const dbClient = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const DRY_RUN = process.env.DRY_RUN === 'false' ? false : true;

async function convertToWebP() {
  console.log(`🚀 Starting PNG to WebP conversion (DRY_RUN: ${DRY_RUN})`);
  
  try {
    await dbClient.connect();
    
    // 1. Get all PNG URLs from tour_packages and gallery
    const queries = [
      { table: 'tour_packages', id_col: 'package_id', url_col: 'image' },
      { table: 'gallery', id_col: 'gallery_id', url_col: 'image_url' },
      { table: 'destinations', id_col: 'destination_id', url_col: 'image_url' },
      { table: 'users', id_col: 'user_id', url_col: 'avatar_url' },
      { table: 'guide_documents', id_col: 'document_id', url_col: 'file_url' }
    ];
    
    for (const q of queries) {
      console.log(`\n🔍 Checking table: ${q.table}`);
      // Check if table exists first
      const tableCheck = await dbClient.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        );
      `, [q.table]);
      
      if (!tableCheck.rows[0].exists) {
        console.log(`Table ${q.table} does not exist. Skipping.`);
        continue;
      }

      // Check if column exists
      const columnCheck = await dbClient.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = $1
          AND column_name = $2
        );
      `, [q.table, q.url_col]);

      if (!columnCheck.rows[0].exists) {
        console.log(`Column ${q.url_col} in table ${q.table} does not exist. Skipping.`);
        continue;
      }

      const res = await dbClient.query(`
        SELECT ${q.id_col}, ${q.url_col} 
        FROM ${q.table} 
        WHERE ${q.url_col} ILIKE '%.png%'
           OR ${q.url_col} ILIKE '%.jpg%'
           OR ${q.url_col} ILIKE '%.jpeg%'
           OR ${q.url_col} ILIKE '%.jfif%'
      `);
      
      console.log(`Found ${res.rows.length} images to convert in ${q.table}`);
      
      for (const row of res.rows) {
        const url = row[q.url_col];
        const id = row[q.id_col];
        
        console.log(`\nProcessing: ${url}`);
        
        try {
          // Extract file path from Supabase URL
          // Regex to capture bucket and path from public OR signed Supabase storage URLs
          // It also ignores any query parameters (like tokens)
          const supabaseRegex = /\/storage\/v1\/object\/(?:public|sign)\/([^\/]+)\/([^?]+)(?:\?.*)?$/;
          const match = url.match(supabaseRegex);
          
          if (!match) {
            console.warn(`Could not parse Supabase path from URL: ${url}`);
            continue;
          }
          
          const bucket = match[1];
          let supabasePath = decodeURIComponent(match[2]);
          // Replace any of the supported extensions with .webp
          const webpPath = supabasePath.replace(/\.(png|jpg|jpeg|jfif)$/i, '.webp');
          
          if (DRY_RUN) {
            console.log(`[DRY RUN] Would convert ${supabasePath} to ${webpPath}`);
            continue;
          }
          
          // 2. Download
          const response = await axios.get(url, { responseType: 'arraybuffer' });
          const buffer = Buffer.from(response.data);
          
          // 3. Convert
          const webpBuffer = await sharp(buffer)
            .webp({ quality: 80 })
            .toBuffer();
          
          // 4. Upload to Supabase
          const { data, error: uploadError } = await supabase.storage
            .from(bucket)
            .upload(webpPath, webpBuffer, {
              contentType: 'image/webp',
              upsert: true
            });
            
          if (uploadError) {
            throw new Error(`Upload failed: ${uploadError.message}`);
          }
          
          // 5. Get Public URL for the new WebP
          const { data: { publicUrl } } = supabase.storage
            .from(bucket)
            .getPublicUrl(webpPath);
            
          // 6. Update Database
          await dbClient.query(`
            UPDATE ${q.table} 
            SET ${q.url_col} = $1 
            WHERE ${q.id_col} = $2
          `, [publicUrl, id]);
          
          console.log(`✅ Success: Updated ${q.table} ID ${id} to ${publicUrl}`);
          
        } catch (err) {
          console.error(`❌ Error processing ${url}:`, err.message);
        }
      }
    }
    
    console.log('\n✨ Conversion process completed.');
    
  } catch (err) {
    console.error('🔥 Critical Error:', err);
  } finally {
    await dbClient.end();
  }
}

convertToWebP();
