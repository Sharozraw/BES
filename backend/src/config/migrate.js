const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

const migrate = async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Enable UUID extension
    await client.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    // Roles table
    await client.query(`
      CREATE TABLE IF NOT EXISTS roles (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(50) UNIQUE NOT NULL,
        description TEXT,
        permissions JSONB DEFAULT '[]',
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        role_id UUID REFERENCES roles(id),
        department VARCHAR(255),
        phone VARCHAR(50),
        designation VARCHAR(255),
        is_active BOOLEAN DEFAULT TRUE,
        last_login TIMESTAMP,
        password_reset_token VARCHAR(255),
        password_reset_expires TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Projects table
    await client.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        file_no VARCHAR(255) UNIQUE NOT NULL,
        title VARCHAR(500) NOT NULL,
        description TEXT,
        department VARCHAR(255),
        estimated_amount DECIMAL(15,2),
        currency VARCHAR(10) DEFAULT 'LKR',
        source_of_financing VARCHAR(255),
        procurement_method VARCHAR(100),
        status VARCHAR(50) DEFAULT 'draft',
        created_by UUID REFERENCES users(id),
        invitation_date DATE,
        bid_close_date TIMESTAMP,
        bid_open_date TIMESTAMP,
        pre_bid_date TIMESTAMP,
        document_sale_date DATE,
        document_price DECIMAL(10,2),
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Workflow table (one per project)
    await client.query(`
      CREATE TABLE IF NOT EXISTS workflows (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        current_stage_index INTEGER DEFAULT 0,
        final_decision_method VARCHAR(50) DEFAULT 'ranking',
        settings JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Stages table
    await client.query(`
      CREATE TABLE IF NOT EXISTS stages (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        workflow_id UUID REFERENCES workflows(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        stage_order INTEGER NOT NULL,
        scoring_method VARCHAR(50) DEFAULT 'pass_fail',
        decision_method VARCHAR(50) DEFAULT 'accept_reject',
        is_voting_enabled BOOLEAN DEFAULT FALSE,
        min_votes_required INTEGER DEFAULT 1,
        is_comments_mandatory BOOLEAN DEFAULT FALSE,
        required_documents JSONB DEFAULT '[]',
        pass_threshold DECIMAL(5,2) DEFAULT 0,
        auto_advance BOOLEAN DEFAULT TRUE,
        settings JSONB DEFAULT '{}',
        status VARCHAR(50) DEFAULT 'pending',
        started_at TIMESTAMP,
        completed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Criteria table
    await client.query(`
      CREATE TABLE IF NOT EXISTS criteria (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        stage_id UUID REFERENCES stages(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        criteria_type VARCHAR(50) DEFAULT 'pass_fail',
        weight DECIMAL(5,2) DEFAULT 1.0,
        max_score DECIMAL(8,2) DEFAULT 100,
        is_mandatory BOOLEAN DEFAULT TRUE,
        options JSONB DEFAULT '[]',
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Bidders table
    await client.query(`
      CREATE TABLE IF NOT EXISTS bidders (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
        name VARCHAR(500) NOT NULL,
        address TEXT,
        contact_person VARCHAR(255),
        email VARCHAR(255),
        phone VARCHAR(100),
        bid_price DECIMAL(15,2),
        currency VARCHAR(10) DEFAULT 'LKR',
        bid_price_with_vat DECIMAL(15,2),
        registration_no VARCHAR(255),
        status VARCHAR(50) DEFAULT 'active',
        elimination_stage_id UUID REFERENCES stages(id),
        elimination_reason TEXT,
        extracted_data JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Documents table
    await client.query(`
      CREATE TABLE IF NOT EXISTS documents (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
        bidder_id UUID REFERENCES bidders(id) ON DELETE CASCADE,
        uploaded_by UUID REFERENCES users(id),
        file_name VARCHAR(500) NOT NULL,
        original_name VARCHAR(500),
        file_path VARCHAR(1000) NOT NULL,
        file_size INTEGER,
        mime_type VARCHAR(100),
        document_type VARCHAR(100) DEFAULT 'bid_document',
        extracted_text TEXT,
        extraction_status VARCHAR(50) DEFAULT 'pending',
        parsed_data JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Project Evaluators (assignment)
    await client.query(`
      CREATE TABLE IF NOT EXISTS project_evaluators (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        role VARCHAR(100) DEFAULT 'member',
        assigned_by UUID REFERENCES users(id),
        assigned_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(project_id, user_id)
      )
    `);

    // Evaluations table
    await client.query(`
      CREATE TABLE IF NOT EXISTS evaluations (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        stage_id UUID REFERENCES stages(id) ON DELETE CASCADE,
        bidder_id UUID REFERENCES bidders(id) ON DELETE CASCADE,
        evaluator_id UUID REFERENCES users(id) ON DELETE CASCADE,
        criteria_id UUID REFERENCES criteria(id) ON DELETE CASCADE,
        score DECIMAL(8,2),
        pass_fail VARCHAR(10),
        rank INTEGER,
        compliance_status VARCHAR(50),
        response_value TEXT,
        is_deviation BOOLEAN DEFAULT FALSE,
        deviation_description TEXT,
        is_minor_deviation BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(stage_id, bidder_id, evaluator_id, criteria_id)
      )
    `);

    // Comments table
    await client.query(`
      CREATE TABLE IF NOT EXISTS comments (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        stage_id UUID REFERENCES stages(id) ON DELETE CASCADE,
        bidder_id UUID REFERENCES bidders(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        comment TEXT NOT NULL,
        comment_type VARCHAR(50) DEFAULT 'general',
        is_private BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Votes table
    await client.query(`
      CREATE TABLE IF NOT EXISTS votes (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        stage_id UUID REFERENCES stages(id) ON DELETE CASCADE,
        bidder_id UUID REFERENCES bidders(id) ON DELETE CASCADE,
        voter_id UUID REFERENCES users(id) ON DELETE CASCADE,
        vote VARCHAR(20) NOT NULL,
        justification TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(stage_id, bidder_id, voter_id)
      )
    `);

    // Final decisions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS final_decisions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
        bidder_id UUID REFERENCES bidders(id),
        decision_method VARCHAR(50),
        decision VARCHAR(50),
        contract_amount DECIMAL(15,2),
        reasons TEXT,
        decided_by UUID REFERENCES users(id),
        agreed_by JSONB DEFAULT '[]',
        decision_date TIMESTAMP DEFAULT NOW(),
        is_approved BOOLEAN DEFAULT FALSE,
        approved_by UUID REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Reports table
    await client.query(`
      CREATE TABLE IF NOT EXISTS reports (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
        report_type VARCHAR(100) NOT NULL,
        title VARCHAR(500),
        file_path VARCHAR(1000),
        generated_by UUID REFERENCES users(id),
        parameters JSONB DEFAULT '{}',
        status VARCHAR(50) DEFAULT 'generating',
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Audit logs table
    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID REFERENCES users(id),
        project_id UUID REFERENCES projects(id),
        action VARCHAR(255) NOT NULL,
        entity_type VARCHAR(100),
        entity_id UUID,
        old_values JSONB,
        new_values JSONB,
        ip_address VARCHAR(45),
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Notifications table
    await client.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
        title VARCHAR(500) NOT NULL,
        message TEXT,
        type VARCHAR(50) DEFAULT 'info',
        is_read BOOLEAN DEFAULT FALSE,
        link VARCHAR(500),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create indexes
    await client.query(`CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_projects_created_by ON projects(created_by)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_bidders_project ON bidders(project_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_evaluations_stage ON evaluations(stage_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_evaluations_bidder ON evaluations(bidder_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_audit_logs_project ON audit_logs(project_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id)`);

    await client.query('COMMIT');
    console.log('✅ Migration completed successfully');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', err);
    throw err;
  } finally {
    client.release();
    pool.end();
  }
};

migrate();
