-- Migration: Add logged_by_user_id column to tracking tables
-- This adds user attribution for all logging activities

-- Add logged_by_user_id to weight_logs
ALTER TABLE weight_logs
ADD COLUMN IF NOT EXISTS logged_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;

-- Add logged_by_user_id to health_records
ALTER TABLE health_records
ADD COLUMN IF NOT EXISTS logged_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;

-- Add logged_by_user_id to misting_logs
ALTER TABLE misting_logs
ADD COLUMN IF NOT EXISTS logged_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;

-- Add logged_by_user_id to measurements
ALTER TABLE measurements
ADD COLUMN IF NOT EXISTS logged_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
