// migrate_tender_engine.js
// node src/config/migrate_tender_engine.js

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST, port: process.env.DB_PORT,
  database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD,
});

const migrate = async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      CREATE TABLE IF NOT EXISTS work_packages (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        name VARCHAR(500) NOT NULL,
        description TEXT,
        evaluator_id UUID REFERENCES users(id),
        source VARCHAR(20) DEFAULT 'manual',
        source_document_id UUID,
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS items (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        work_package_id UUID REFERENCES work_packages(id) ON DELETE CASCADE,
        item_no VARCHAR(100),
        description TEXT NOT NULL,
        unit VARCHAR(100),
        quantity DECIMAL(15,4),
        source VARCHAR(20) DEFAULT 'manual',
        sort_order INTEGER DEFAULT 0,
        eval_status VARCHAR(30) DEFAULT 'creation',
        evaluator_id UUID REFERENCES users(id) ON DELETE SET NULL,
        evaluation_step INTEGER DEFAULT 0,
        source_document_id UUID,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await client.query(`ALTER TABLE items ADD COLUMN IF NOT EXISTS evaluation_step INTEGER DEFAULT 0`);
    await client.query(`ALTER TABLE items ADD COLUMN IF NOT EXISTS evaluator_id UUID REFERENCES users(id) ON DELETE SET NULL`);
    await client.query(`ALTER TABLE items ADD COLUMN IF NOT EXISTS source_document_id UUID`);
    await client.query(`ALTER TABLE bidders ADD COLUMN IF NOT EXISTS source_document_id UUID`);
    await client.query(`ALTER TABLE documents ADD COLUMN IF NOT EXISTS target_work_package_id UUID`);
    await client.query(`ALTER TABLE documents ADD COLUMN IF NOT EXISTS target_item_id UUID`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS item_revisions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
        entity_type VARCHAR(100) NOT NULL,
        entity_id UUID,
        changed_by UUID REFERENCES users(id),
        old_values JSONB,
        new_values JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS item_bidders (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
        bidder_id UUID NOT NULL REFERENCES bidders(id) ON DELETE CASCADE,
        bidder_no INTEGER,
        readout_price DECIMAL(15,2),
        currency VARCHAR(10) DEFAULT 'LKR',
        address_override TEXT,
        remarks TEXT,
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        source_document_id UUID,
        UNIQUE(item_id, bidder_id)
      )
    `);
    await client.query(`ALTER TABLE item_bidders ADD COLUMN IF NOT EXISTS source_document_id UUID`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS table41_rows (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
        item_bidder_id UUID REFERENCES item_bidders(id) ON DELETE SET NULL,
        bidder_no INTEGER,
        bidder_name VARCHAR(500),
        address TEXT,
        readout_price DECIMAL(15,2),
        currency VARCHAR(10) DEFAULT 'LKR',
        remarks TEXT,
        is_manual_addition BOOLEAN DEFAULT FALSE,
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await client.query(`ALTER TABLE table41_rows ADD COLUMN IF NOT EXISTS source_document_id UUID`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS table51_rows (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
        field_key VARCHAR(200) NOT NULL,
        field_label VARCHAR(500) NOT NULL,
        field_type VARCHAR(30) DEFAULT 'text',
        is_system BOOLEAN DEFAULT FALSE,
        sort_order INTEGER DEFAULT 0,
        values JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(item_id, field_key)
      )
    `);
    await client.query(`ALTER TABLE table51_rows ADD COLUMN IF NOT EXISTS source_document_id UUID`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS table51_acceptance (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
        bidder_id UUID NOT NULL REFERENCES bidders(id) ON DELETE CASCADE,
        accepted BOOLEAN DEFAULT TRUE,
        reason TEXT,
        updated_at TIMESTAMP DEFAULT NOW(),
        source_document_id UUID,
        UNIQUE(item_id, bidder_id)
      )
    `);
    await client.query(`ALTER TABLE table51_acceptance ADD COLUMN IF NOT EXISTS source_document_id UUID`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS technical_spec_rows (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
        feature VARCHAR(500) NOT NULL,
        requirement TEXT,
        sort_order INTEGER DEFAULT 0,
        values JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS table6_rows (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
        bidder_id UUID REFERENCES bidders(id) ON DELETE SET NULL,
        clarification_no INTEGER,
        subject TEXT,
        query_text TEXT,
        response_text TEXT,
        custom_fields JSONB DEFAULT '{}',
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS table7_rows (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
        bidder_id UUID REFERENCES bidders(id) ON DELETE SET NULL,
        item_description TEXT,
        requirement TEXT,
        offered TEXT,
        bid_rejected BOOLEAN DEFAULT FALSE,
        is_minor BOOLEAN DEFAULT FALSE,
        is_auto_populated BOOLEAN DEFAULT FALSE,
        loading_amount DECIMAL(15,2) DEFAULT 0,
        custom_fields JSONB DEFAULT '{}',
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await client.query(`ALTER TABLE table7_rows ADD COLUMN IF NOT EXISTS is_auto_populated BOOLEAN DEFAULT FALSE`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS table81_rows (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
        bidder_id UUID NOT NULL REFERENCES bidders(id) ON DELETE CASCADE,
        bid_price DECIMAL(15,2),
        arithmetic_errors DECIMAL(15,2) DEFAULT 0,
        discounts DECIMAL(15,2) DEFAULT 0,
        additions_omissions DECIMAL(15,2) DEFAULT 0,
        evaluated_bid_price DECIMAL(15,2),
        quantity DECIMAL(15,4) DEFAULT 1,
        rank INTEGER,
        custom_fields JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(item_id, bidder_id)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS table811_rows (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
        bidder_id UUID REFERENCES bidders(id) ON DELETE SET NULL,
        criteria_label VARCHAR(500),
        complied BOOLEAN,
        accepted BOOLEAN,
        notes TEXT,
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS contract_award_recommendations (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
        bidder_id UUID REFERENCES bidders(id),
        address VARCHAR(500),
        contract_amount VARCHAR(500),
        brand_model VARCHAR(500),
        warranty VARCHAR(255),
        rejection_reasons JSONB DEFAULT '[]',
        comments TEXT,
        recommended_for_award BOOLEAN DEFAULT TRUE,
        signatures JSONB DEFAULT '[]',
        award_date DATE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(item_id)
      )
    `);
    await client.query(`ALTER TABLE contract_award_recommendations ADD COLUMN IF NOT EXISTS address VARCHAR(500)`);

    await client.query(`
      UPDATE table7_rows d SET is_auto_populated=true
      WHERE d.bid_rejected=true AND d.bidder_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM table51_acceptance a
          WHERE a.item_id=d.item_id AND a.bidder_id=d.bidder_id AND a.accepted=false
        )
    `);

    await client.query(`
      DELETE FROM table7_rows
      WHERE id IN (
        SELECT id FROM (
          SELECT id, ROW_NUMBER() OVER (PARTITION BY item_id, bidder_id ORDER BY created_at, id) AS row_no
          FROM table7_rows WHERE bidder_id IS NOT NULL AND is_auto_populated=true
        ) duplicates WHERE row_no > 1
      )
    `);
    await client.query(`
      DELETE FROM table811_rows
      WHERE id IN (
        SELECT id FROM (
          SELECT id, ROW_NUMBER() OVER (PARTITION BY item_id, bidder_id, criteria_label ORDER BY created_at, id) AS row_no
          FROM table811_rows WHERE bidder_id IS NOT NULL
        ) duplicates WHERE row_no > 1
      )
    `);
    await client.query('DROP INDEX IF EXISTS uq_table7_item_bidder');
    await client.query('CREATE UNIQUE INDEX IF NOT EXISTS uq_table7_item_bidder_auto ON table7_rows(item_id, bidder_id) WHERE bidder_id IS NOT NULL AND is_auto_populated=true');
    await client.query('CREATE UNIQUE INDEX IF NOT EXISTS uq_table811_item_bidder_criteria ON table811_rows(item_id, bidder_id, criteria_label) WHERE bidder_id IS NOT NULL');

    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_work_packages_project ON work_packages(project_id)',
      'CREATE INDEX IF NOT EXISTS idx_items_project ON items(project_id)',
      'CREATE INDEX IF NOT EXISTS idx_items_wp ON items(work_package_id)',
      'CREATE INDEX IF NOT EXISTS idx_item_bidders_item ON item_bidders(item_id)',
      'CREATE INDEX IF NOT EXISTS idx_table41_item ON table41_rows(item_id)',
      'CREATE INDEX IF NOT EXISTS idx_table51_item ON table51_rows(item_id)',
      'CREATE INDEX IF NOT EXISTS idx_table51_acc_item ON table51_acceptance(item_id)',
      'CREATE INDEX IF NOT EXISTS idx_techspec_item ON technical_spec_rows(item_id)',
      'CREATE INDEX IF NOT EXISTS idx_table6_item ON table6_rows(item_id)',
      'CREATE INDEX IF NOT EXISTS idx_table7_item ON table7_rows(item_id)',
      'CREATE INDEX IF NOT EXISTS idx_table81_item ON table81_rows(item_id)',
      'CREATE INDEX IF NOT EXISTS idx_table811_item ON table811_rows(item_id)',
      'CREATE INDEX IF NOT EXISTS idx_car_item ON contract_award_recommendations(item_id)',
    ];
    for (const sql of indexes) await client.query(sql);

    await client.query('COMMIT');
    console.log('✅ Tender engine migration completed');
    console.log('   Tables: work_packages, items, item_bidders,');
    console.log('   table41_rows, table51_rows, table51_acceptance,');
    console.log('   technical_spec_rows, table6_rows, table7_rows,');
    console.log('   table81_rows, table811_rows, contract_award_recommendations');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', err.message);
    throw err;
  } finally {
    client.release();
    pool.end();
  }
};

migrate();
