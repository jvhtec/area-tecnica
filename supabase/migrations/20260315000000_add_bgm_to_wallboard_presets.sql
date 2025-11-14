-- Add background music (BGM) radio station fields to wallboard_presets
-- These fields allow each wallboard to have continuous radio playback

ALTER TABLE wallboard_presets
  ADD COLUMN bgm_station_name TEXT DEFAULT NULL,
  ADD COLUMN bgm_stream_url TEXT DEFAULT NULL,
  ADD COLUMN bgm_fallbacks JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN wallboard_presets.bgm_station_name IS 'Name of the selected radio station for background music';
COMMENT ON COLUMN wallboard_presets.bgm_stream_url IS 'Primary stream URL for the radio station';
COMMENT ON COLUMN wallboard_presets.bgm_fallbacks IS 'Array of fallback stream URLs for resilience';
