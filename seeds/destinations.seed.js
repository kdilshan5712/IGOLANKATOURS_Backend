import db from '../src/config/db.js';

const destinations = [
    {
        name: "Sigiriya",
        category: "Cultural",
        description:
            "Sigiriya is an ancient rock fortress and one of Sri Lanka's most iconic landmarks. Rising nearly 200 meters above the surrounding plains, it features remarkable frescoes, landscaped gardens, and the remains of a 5th-century royal palace.",
        image_url:
            "https://exfyprnpkplhzuuloebf.supabase.co/storage/v1/object/sign/tour-images/tour-images/destinations/sigiriyaRock.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV8zMzVhYmI2Ny1lZDVkLTQ0MDktOGNiNS0wNGI4MjgzZGUxNmYiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJ0b3VyLWltYWdlcy90b3VyLWltYWdlcy9kZXN0aW5hdGlvbnMvc2lnaXJpeWFSb2NrLnBuZyIsImlhdCI6MTc2ODU4NjIyOCwiZXhwIjoxODAwMTIyMjI4fQ.dS3hGhIXJh0rbVJh_22v0GyYrWK-VaMxQFmBRmuCOkI",
    },
    {
        name: "Kandy",
        category: "Cultural",
        description:
            "Kandy is a sacred city nestled in the central hills, home to the Temple of the Tooth Relic, one of Buddhism's most revered sites. The city blends cultural heritage with natural beauty, featuring a scenic lake, traditional dance performances, and the nearby Royal Botanical Gardens.",
        image_url:
            "https://exfyprnpkplhzuuloebf.supabase.co/storage/v1/object/sign/tour-images/tour-images/destinations/kandy.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV8zMzVhYmI2Ny1lZDVkLTQ0MDktOGNiNS0wNGI4MjgzZGUxNmYiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJ0b3VyLWltYWdlcy90b3VyLWltYWdlcy9kZXN0aW5hdGlvbnMva2FuZHkucG5nIiwiaWF0IjoxNzY4NTg1OTk5LCJleHAiOjE4MDAxMjE5OTl9.S9fjTptzFD7DTF3jWTrpJh4UjmzQe_js_GhTWosYYv0",
    },
    {
        name: "Ella",
        category: "Nature",
        description:
            "Ella is a charming mountain town known for its stunning vistas, rolling tea estates, and laid-back atmosphere. Popular attractions include the Nine Arch Bridge, Little Adam's Peak, and Ella Rock, all offering spectacular hiking experiences.",
        image_url:
            "https://exfyprnpkplhzuuloebf.supabase.co/storage/v1/object/sign/tour-images/tour-images/destinations/Ella.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV8zMzVhYmI2Ny1lZDVkLTQ0MDktOGNiNS0wNGI4MjgzZGUxNmYiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJ0b3VyLWltYWdlcy90b3VyLWltYWdlcy9kZXN0aW5hdGlvbnMvRWxsYS5wbmciLCJpYXQiOjE3Njg1ODU3NzQsImV4cCI6MTgwMDEyMTc3NH0.f6FoLcMxe86B8NTozCC-jt6QD0usqWuT0OYYJrPKbUk",
    },
    {
        name: "Nuwara Eliya",
        category: "Nature",
        description:
            "Often called \"Little England,\" Nuwara Eliya sits at the heart of Sri Lanka's tea country with its cool climate and colonial-era architecture. Visitors can tour world-renowned tea factories, explore sprawling plantations, and enjoy the picturesque landscapes of Horton Plains National Park.",
        image_url:
            "https://exfyprnpkplhzuuloebf.supabase.co/storage/v1/object/sign/tour-images/tour-images/destinations/nuwaraeliya.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV8zMzVhYmI2Ny1lZDVkLTQ0MDktOGNiNS0wNGI4MjgzZGUxNmYiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJ0b3VyLWltYWdlcy90b3VyLWltYWdlcy9kZXN0aW5hdGlvbnMvbnV3YXJhZWxpeWEucG5nIiwiaWF0IjoxNzY4NTgxNTc3LCJleHAiOjE4MDAxMTc1Nzd9.QjLX5etS9tNSU0a8cpuBJc9hQrjSbDi3yx5vQ_PkdQc",
    },
    {
        name: "Galle",
        category: "Cultural",
        description:
            "Galle is a historic coastal city famous for its well-preserved Dutch Fort, a UNESCO World Heritage Site dating back to the 17th century. The fort area features charming boutiques, cafes, museums, and colonial architecture within its ramparts.",
        image_url:
            "https://exfyprnpkplhzuuloebf.supabase.co/storage/v1/object/sign/tour-images/tour-images/destinations/galle.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV8zMzVhYmI2Ny1lZDVkLTQ0MDktOGNiNS0wNGI4MjgzZGUxNmYiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJ0b3VyLWltYWdlcy90b3VyLWltYWdlcy9kZXN0aW5hdGlvbnMvZ2FsbGUucG5nIiwiaWF0IjoxNzY4NTg1Nzk5LCJleHAiOjE4MDAxMjE3OTl9.V_DdXV7al2X55SV0eG-pjY9YtND_zhkdd4daTadmlSE",
    },
    {
        name: "Mirissa",
        category: "Beach",
        description:
            "Mirissa is a tranquil beach destination on the southern coast, renowned for its golden sands and excellent whale watching opportunities. The relaxed atmosphere, palm-fringed shores, and vibrant beach scene make it ideal for both relaxation and water activities.",
        image_url:
            "https://exfyprnpkplhzuuloebf.supabase.co/storage/v1/object/sign/tour-images/tour-images/destinations/mirissa.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV8zMzVhYmI2Ny1lZDVkLTQ0MDktOGNiNS0wNGI4MjgzZGUxNmYiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJ0b3VyLWltYWdlcy90b3VyLWltYWdlcy9kZXN0aW5hdGlvbnMvbWlyaXNzYS5wbmciLCJpYXQiOjE3Njg1ODY1MDIsImV4cCI6MTgwMDEyMjUwMn0.LPfGCBUtObc8TCOjpL2Wi9bK9EaGL-6EOoOYzTWik7Y",
    },
    {
        name: "Yala National Park",
        category: "Wildlife",
        description:
            "Yala National Park is Sri Lanka's most visited wildlife reserve, famous for having one of the highest leopard densities in the world. The park is home to elephants, sloth bears, crocodiles, and over 200 bird species across diverse ecosystems.",
        image_url:
            "https://exfyprnpkplhzuuloebf.supabase.co/storage/v1/object/sign/tour-images/tour-images/destinations/yala.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV8zMzVhYmI2Ny1lZDVkLTQ0MDktOGNiNS0wNGI4MjgzZGUxNmYiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJ0b3VyLWltYWdlcy90b3VyLWltYWdlcy9kZXN0aW5hdGlvbnMveWFsYS5wbmciLCJpYXQiOjE3Njg1ODYxODQsImV4cCI6MTkyNjI2NjE4NH0.A3Jtn33o0iScYF2oBq38gBcjNLEO02ri3XFagprvtd4",
    },
    {
        name: "Bentota",
        category: "Beach",
        description:
            "Bentota is a premier beach resort town known for its pristine coastline and water sports activities including jet skiing, windsurfing, and diving. The Bentota River adds to the scenic beauty and offers boat safaris through mangrove forests.",
        image_url:
            "https://exfyprnpkplhzuuloebf.supabase.co/storage/v1/object/sign/tour-images/tour-images/destinations/bentota.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV8zMzVhYmI2Ny1lZDVkLTQ0MDktOGNiNS0wNGI4MjgzZGUxNmYiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJ0b3VyLWltYWdlcy90b3VyLWltYWdlcy9kZXN0aW5hdGlvbnMvYmVudG90YS5wbmciLCJpYXQiOjE3Njg1ODU4OTAsImV4cCI6MTgwMDEyMTg5MH0.3JIcPnoZtKU-hh7smhnN0zvcrIpPdvsz2fXDWRmXaXE",
    },
    {
        name: "Anuradhapura",
        category: "Cultural",
        description:
            "Anuradhapura is one of Sri Lanka's ancient capitals and a sacred Buddhist pilgrimage site with over 2,000 years of history. The city features massive dagobas, ancient monasteries, and the sacred Bodhi Tree, believed to be the oldest historically documented tree in the world.",
        image_url:
            "https://exfyprnpkplhzuuloebf.supabase.co/storage/v1/object/sign/tour-images/tour-images/destinations/anuradhapura.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV8zMzVhYmI2Ny1lZDVkLTQ0MDktOGNiNS0wNGI4MjgzZGUxNmYiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJ0b3VyLWltYWdlcy90b3VyLWltYWdlcy9kZXN0aW5hdGlvbnMvYW51cmFkaGFwdXJhLnBuZyIsImlhdCI6MTc2ODU4NTc0MCwiZXhwIjoxODAwMTIxNzQwfQ.wrGC3MQvmHV9WpnjFcN3WnSTKMfbTzT_ulvBa-SG7Dg",
    },
    {
        name: "Polonnaruwa",
        category: "Cultural",
        description:
            "Polonnaruwa served as Sri Lanka's medieval capital and remains one of the best-preserved ancient cities in South Asia. Visitors can explore impressive archaeological sites including royal palaces, Buddha statues, and intricate stone carvings.",
        image_url:
            "https://exfyprnpkplhzuuloebf.supabase.co/storage/v1/object/sign/tour-images/tour-images/destinations/polonnaruwa.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV8zMzVhYmI2Ny1lZDVkLTQ0MDktOGNiNS0wNGI4MjgzZGUxNmYiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJ0b3VyLWltYWdlcy90b3VyLWltYWdlcy9kZXN0aW5hdGlvbnMvcG9sb25uYXJ1d2EucG5nIiwiaWF0IjoxNzY4NTg2MzUwLCJleHAiOjE4MDAxMjIzNTB9.HogzDo2oFAQUhkP15CqSGOzTSBv_W3qmf9yMW5jP--U",
    },
];

const seedDestinations = async () => {
    try {
        console.log("Seeding destinations...");

        // Clear existing data (optional, but good for idempotency if we want a fresh start)
        await db.query("DELETE FROM destinations");

        for (const dest of destinations) {
            await db.query(`
                INSERT INTO destinations (name, category, description, image_url)
                VALUES ($1, $2, $3, $4)
            `, [dest.name, dest.category, dest.description, dest.image_url]);
        }

        console.log(`✅ Seeded ${destinations.length} destinations.`);
        process.exit(0);
    } catch (err) {
        console.error("❌ Error seeding destinations:", err);
        process.exit(1);
    }
};

seedDestinations();
