export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      admin_audit_log: {
        Row: {
          action_type: string
          admin_user_id: string
          details: Json | null
          id: string
          ip_address: unknown
          performed_at: string
          target_id: string | null
          target_resource: string
          user_agent: string | null
        }
        Insert: {
          action_type: string
          admin_user_id: string
          details?: Json | null
          id?: string
          ip_address?: unknown
          performed_at?: string
          target_id?: string | null
          target_resource: string
          user_agent?: string | null
        }
        Update: {
          action_type?: string
          admin_user_id?: string
          details?: Json | null
          id?: string
          ip_address?: unknown
          performed_at?: string
          target_id?: string | null
          target_resource?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      admin_sessions: {
        Row: {
          admin_user_id: string
          created_at: string
          id: string
          ip_address: unknown
          is_active: boolean | null
          last_activity: string | null
          session_end: string | null
          session_start: string
          user_agent: string | null
        }
        Insert: {
          admin_user_id: string
          created_at?: string
          id?: string
          ip_address?: unknown
          is_active?: boolean | null
          last_activity?: string | null
          session_end?: string | null
          session_start?: string
          user_agent?: string | null
        }
        Update: {
          admin_user_id?: string
          created_at?: string
          id?: string
          ip_address?: unknown
          is_active?: boolean | null
          last_activity?: string | null
          session_end?: string | null
          session_start?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      billing_details: {
        Row: {
          billing_banner: string | null
          created_at: string
          currency: string | null
          current_price_id: string | null
          current_subscription_id: string | null
          grace_until: string | null
          id: string
          last_invoice_status: string | null
          past_due_since: string | null
          stripe_customer_id: string | null
          subscription_status: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          billing_banner?: string | null
          created_at?: string
          currency?: string | null
          current_price_id?: string | null
          current_subscription_id?: string | null
          grace_until?: string | null
          id?: string
          last_invoice_status?: string | null
          past_due_since?: string | null
          stripe_customer_id?: string | null
          subscription_status?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          billing_banner?: string | null
          created_at?: string
          currency?: string | null
          current_price_id?: string | null
          current_subscription_id?: string | null
          grace_until?: string | null
          id?: string
          last_invoice_status?: string | null
          past_due_since?: string | null
          stripe_customer_id?: string | null
          subscription_status?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      deleted_users: {
        Row: {
          acquisition_campaign: string | null
          acquisition_medium: string | null
          acquisition_source: string | null
          created_at: string
          days_as_user: number | null
          deleted_at: string
          email: string | null
          id: string
          original_user_id: string
          plan_tier: Database["public"]["Enums"]["plan_tier_enum"] | null
          storage_used_mb: number | null
          subscription_active: boolean | null
          subscription_status: string | null
          total_posts_created: number | null
          total_workspaces_created: number | null
          was_paying_user: boolean | null
        }
        Insert: {
          acquisition_campaign?: string | null
          acquisition_medium?: string | null
          acquisition_source?: string | null
          created_at: string
          days_as_user?: number | null
          deleted_at?: string
          email?: string | null
          id?: string
          original_user_id: string
          plan_tier?: Database["public"]["Enums"]["plan_tier_enum"] | null
          storage_used_mb?: number | null
          subscription_active?: boolean | null
          subscription_status?: string | null
          total_posts_created?: number | null
          total_workspaces_created?: number | null
          was_paying_user?: boolean | null
        }
        Update: {
          acquisition_campaign?: string | null
          acquisition_medium?: string | null
          acquisition_source?: string | null
          created_at?: string
          days_as_user?: number | null
          deleted_at?: string
          email?: string | null
          id?: string
          original_user_id?: string
          plan_tier?: Database["public"]["Enums"]["plan_tier_enum"] | null
          storage_used_mb?: number | null
          subscription_active?: boolean | null
          subscription_status?: string | null
          total_posts_created?: number | null
          total_workspaces_created?: number | null
          was_paying_user?: boolean | null
        }
        Relationships: []
      }
      follower_stats: {
        Row: {
          created_at: string
          created_by: string
          follower_count: number
          id: string
          platform: string
          username: string
          week_start_date: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          follower_count: number
          id?: string
          platform: string
          username: string
          week_start_date: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          follower_count?: number
          id?: string
          platform?: string
          username?: string
          week_start_date?: string
          workspace_id?: string
        }
        Relationships: []
      }
      instagram_accounts: {
        Row: {
          access_token: string
          account_type: string | null
          can_publish: boolean | null
          created_at: string
          expires_at: string | null
          id: string
          instagram_business_account_id: string | null
          instagram_user_id: string
          page_access_token: string | null
          page_id: string | null
          profile_picture_url: string | null
          token_type: string
          updated_at: string
          user_id: string
          username: string
          workspace_id: string
        }
        Insert: {
          access_token: string
          account_type?: string | null
          can_publish?: boolean | null
          created_at?: string
          expires_at?: string | null
          id?: string
          instagram_business_account_id?: string | null
          instagram_user_id: string
          page_access_token?: string | null
          page_id?: string | null
          profile_picture_url?: string | null
          token_type?: string
          updated_at?: string
          user_id: string
          username: string
          workspace_id: string
        }
        Update: {
          access_token?: string
          account_type?: string | null
          can_publish?: boolean | null
          created_at?: string
          expires_at?: string | null
          id?: string
          instagram_business_account_id?: string | null
          instagram_user_id?: string
          page_access_token?: string | null
          page_id?: string | null
          profile_picture_url?: string | null
          token_type?: string
          updated_at?: string
          user_id?: string
          username?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "instagram_accounts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      instagram_insights: {
        Row: {
          avg_comments: number | null
          avg_engagement_rate: number | null
          avg_likes: number | null
          created_at: string | null
          fetched_at: string | null
          follower_count: number | null
          following_count: number | null
          id: string
          impressions: number | null
          integration_id: string
          media_count: number | null
          period_end: string | null
          period_start: string | null
          profile_views: number | null
          reach: number | null
          top_posts: Json | null
          website_clicks: number | null
          workspace_id: string
        }
        Insert: {
          avg_comments?: number | null
          avg_engagement_rate?: number | null
          avg_likes?: number | null
          created_at?: string | null
          fetched_at?: string | null
          follower_count?: number | null
          following_count?: number | null
          id?: string
          impressions?: number | null
          integration_id: string
          media_count?: number | null
          period_end?: string | null
          period_start?: string | null
          profile_views?: number | null
          reach?: number | null
          top_posts?: Json | null
          website_clicks?: number | null
          workspace_id: string
        }
        Update: {
          avg_comments?: number | null
          avg_engagement_rate?: number | null
          avg_likes?: number | null
          created_at?: string | null
          fetched_at?: string | null
          follower_count?: number | null
          following_count?: number | null
          id?: string
          impressions?: number | null
          integration_id?: string
          media_count?: number | null
          period_end?: string | null
          period_start?: string | null
          profile_views?: number | null
          reach?: number | null
          top_posts?: Json | null
          website_clicks?: number | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "instagram_insights_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "social_integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instagram_insights_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          token: string
          workspace_id: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          token: string
          workspace_id: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          token?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      media_assets: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          file_hash: string | null
          id: string
          mime_type: string | null
          owner_user_id: string | null
          r2_key: string | null
          size_bytes: number | null
          uploaded_by: string | null
          workspace_id: string | null
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          file_hash?: string | null
          id?: string
          mime_type?: string | null
          owner_user_id?: string | null
          r2_key?: string | null
          size_bytes?: number | null
          uploaded_by?: string | null
          workspace_id?: string | null
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          file_hash?: string | null
          id?: string
          mime_type?: string | null
          owner_user_id?: string | null
          r2_key?: string | null
          size_bytes?: number | null
          uploaded_by?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "media_assets_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_analytics: {
        Row: {
          aggregated_at: string
          approved_posts: number
          created_by: string
          id: string
          month: number
          pending_posts: number
          platform_distribution: Json
          post_type_distribution: Json
          published_posts: number
          rejected_posts: number
          scheduled_posts: number
          total_posts: number
          workspace_id: string
          year: number
        }
        Insert: {
          aggregated_at?: string
          approved_posts?: number
          created_by: string
          id?: string
          month: number
          pending_posts?: number
          platform_distribution?: Json
          post_type_distribution?: Json
          published_posts?: number
          rejected_posts?: number
          scheduled_posts?: number
          total_posts?: number
          workspace_id: string
          year: number
        }
        Update: {
          aggregated_at?: string
          approved_posts?: number
          created_by?: string
          id?: string
          month?: number
          pending_posts?: number
          platform_distribution?: Json
          post_type_distribution?: Json
          published_posts?: number
          rejected_posts?: number
          scheduled_posts?: number
          total_posts?: number
          workspace_id?: string
          year?: number
        }
        Relationships: []
      }
      plan_limits: {
        Row: {
          features: Json | null
          max_guest_memberships: number | null
          max_owned_workspaces: number | null
          plan_tier: string
          post_expiry_days: number | null
          storage_total_mb: number | null
        }
        Insert: {
          features?: Json | null
          max_guest_memberships?: number | null
          max_owned_workspaces?: number | null
          plan_tier: string
          post_expiry_days?: number | null
          storage_total_mb?: number | null
        }
        Update: {
          features?: Json | null
          max_guest_memberships?: number | null
          max_owned_workspaces?: number | null
          plan_tier?: string
          post_expiry_days?: number | null
          storage_total_mb?: number | null
        }
        Relationships: []
      }
      platform_analytics: {
        Row: {
          aggregated_at: string
          approved_count: number
          created_by: string
          id: string
          month: number
          platform: string
          post_count: number
          published_count: number
          workspace_id: string
          year: number
        }
        Insert: {
          aggregated_at?: string
          approved_count?: number
          created_by: string
          id?: string
          month: number
          platform: string
          post_count?: number
          published_count?: number
          workspace_id: string
          year: number
        }
        Update: {
          aggregated_at?: string
          approved_count?: number
          created_by?: string
          id?: string
          month?: number
          platform?: string
          post_count?: number
          published_count?: number
          workspace_id?: string
          year?: number
        }
        Relationships: []
      }
      post_comments: {
        Row: {
          comment: string
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          comment: string
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          comment?: string
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          additional_comments: string | null
          caption: string | null
          created_at: string
          created_by: string
          expire_at: string | null
          id: string
          media_urls: string[] | null
          platforms: Database["public"]["Enums"]["platform_type"][]
          post_type: Database["public"]["Enums"]["post_type"]
          published_at: string | null
          rejection_reason: string | null
          scheduled_for: string | null
          status: Database["public"]["Enums"]["post_status"]
          thumbnail_urls: string[] | null
          title: string
          updated_at: string
          upload_progress: Json | null
          workspace_id: string
        }
        Insert: {
          additional_comments?: string | null
          caption?: string | null
          created_at?: string
          created_by: string
          expire_at?: string | null
          id?: string
          media_urls?: string[] | null
          platforms: Database["public"]["Enums"]["platform_type"][]
          post_type: Database["public"]["Enums"]["post_type"]
          published_at?: string | null
          rejection_reason?: string | null
          scheduled_for?: string | null
          status?: Database["public"]["Enums"]["post_status"]
          thumbnail_urls?: string[] | null
          title: string
          updated_at?: string
          upload_progress?: Json | null
          workspace_id: string
        }
        Update: {
          additional_comments?: string | null
          caption?: string | null
          created_at?: string
          created_by?: string
          expire_at?: string | null
          id?: string
          media_urls?: string[] | null
          platforms?: Database["public"]["Enums"]["platform_type"][]
          post_type?: Database["public"]["Enums"]["post_type"]
          published_at?: string | null
          rejection_reason?: string | null
          scheduled_for?: string | null
          status?: Database["public"]["Enums"]["post_status"]
          thumbnail_urls?: string[] | null
          title?: string
          updated_at?: string
          upload_progress?: Json | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "posts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          acquisition_campaign: string | null
          acquisition_medium: string | null
          acquisition_source: string | null
          billing_banner: string | null
          created_at: string
          currency: string | null
          current_price_id: string | null
          current_subscription_id: string | null
          date_format: string | null
          email: string
          grace_until: string | null
          id: string
          is_early_adopter: boolean | null
          language: string | null
          last_invoice_status: string | null
          past_due_since: string | null
          plan_tier: Database["public"]["Enums"]["plan_tier_enum"] | null
          referrer_url: string | null
          role: string
          setup_token: string | null
          setup_token_expires_at: string | null
          setup_token_used_at: string | null
          signup_ip: unknown
          storage_used_mb: number | null
          stripe_customer_id: string | null
          subscription_active: boolean | null
          subscription_status: string | null
          trial_ends_at: string | null
          updated_at: string
          user_agent: string | null
          user_id: string
          username: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_id: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
        }
        Insert: {
          acquisition_campaign?: string | null
          acquisition_medium?: string | null
          acquisition_source?: string | null
          billing_banner?: string | null
          created_at?: string
          currency?: string | null
          current_price_id?: string | null
          current_subscription_id?: string | null
          date_format?: string | null
          email: string
          grace_until?: string | null
          id?: string
          is_early_adopter?: boolean | null
          language?: string | null
          last_invoice_status?: string | null
          past_due_since?: string | null
          plan_tier?: Database["public"]["Enums"]["plan_tier_enum"] | null
          referrer_url?: string | null
          role?: string
          setup_token?: string | null
          setup_token_expires_at?: string | null
          setup_token_used_at?: string | null
          signup_ip?: unknown
          storage_used_mb?: number | null
          stripe_customer_id?: string | null
          subscription_active?: boolean | null
          subscription_status?: string | null
          trial_ends_at?: string | null
          updated_at?: string
          user_agent?: string | null
          user_id: string
          username?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_id?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Update: {
          acquisition_campaign?: string | null
          acquisition_medium?: string | null
          acquisition_source?: string | null
          billing_banner?: string | null
          created_at?: string
          currency?: string | null
          current_price_id?: string | null
          current_subscription_id?: string | null
          date_format?: string | null
          email?: string
          grace_until?: string | null
          id?: string
          is_early_adopter?: boolean | null
          language?: string | null
          last_invoice_status?: string | null
          past_due_since?: string | null
          plan_tier?: Database["public"]["Enums"]["plan_tier_enum"] | null
          referrer_url?: string | null
          role?: string
          setup_token?: string | null
          setup_token_expires_at?: string | null
          setup_token_used_at?: string | null
          signup_ip?: unknown
          storage_used_mb?: number | null
          stripe_customer_id?: string | null
          subscription_active?: boolean | null
          subscription_status?: string | null
          trial_ends_at?: string | null
          updated_at?: string
          user_agent?: string | null
          user_id?: string
          username?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_id?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Relationships: []
      }
      referral_codes: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          referral_code: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          referral_code: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          referral_code?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_codes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      referrals: {
        Row: {
          acquisition_metadata: Json | null
          converted_at: string | null
          created_at: string
          credited_at: string | null
          id: string
          referral_code: string
          referred_email: string
          referred_user_id: string | null
          referrer_user_id: string
          status: Database["public"]["Enums"]["referral_status"]
          updated_at: string
        }
        Insert: {
          acquisition_metadata?: Json | null
          converted_at?: string | null
          created_at?: string
          credited_at?: string | null
          id?: string
          referral_code: string
          referred_email: string
          referred_user_id?: string | null
          referrer_user_id: string
          status?: Database["public"]["Enums"]["referral_status"]
          updated_at?: string
        }
        Update: {
          acquisition_metadata?: Json | null
          converted_at?: string | null
          created_at?: string
          credited_at?: string | null
          id?: string
          referral_code?: string
          referred_email?: string
          referred_user_id?: string | null
          referrer_user_id?: string
          status?: Database["public"]["Enums"]["referral_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "referrals_referral_code_fkey"
            columns: ["referral_code"]
            isOneToOne: false
            referencedRelation: "referral_codes"
            referencedColumns: ["referral_code"]
          },
          {
            foreignKeyName: "referrals_referred_user_id_fkey"
            columns: ["referred_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "referrals_referrer_user_id_fkey"
            columns: ["referrer_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      role_changes: {
        Row: {
          changed_at: string
          changed_by: string
          id: string
          ip_address: unknown
          new_role: string
          old_role: string
          reason: string | null
          request_origin: string | null
          session_id: string | null
          target_user_id: string
          user_agent: string | null
        }
        Insert: {
          changed_at?: string
          changed_by: string
          id?: string
          ip_address?: unknown
          new_role: string
          old_role: string
          reason?: string | null
          request_origin?: string | null
          session_id?: string | null
          target_user_id: string
          user_agent?: string | null
        }
        Update: {
          changed_at?: string
          changed_by?: string
          id?: string
          ip_address?: unknown
          new_role?: string
          old_role?: string
          reason?: string | null
          request_origin?: string | null
          session_id?: string | null
          target_user_id?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      social_integrations: {
        Row: {
          access_token: string
          created_at: string | null
          created_by: string
          id: string
          is_active: boolean | null
          metadata: Json | null
          platform: string
          platform_name: string | null
          platform_user_id: string
          platform_username: string
          profile_picture_url: string | null
          refresh_token: string | null
          scopes: string[] | null
          token_expires_at: string | null
          updated_at: string | null
          workspace_id: string
        }
        Insert: {
          access_token: string
          created_at?: string | null
          created_by: string
          id?: string
          is_active?: boolean | null
          metadata?: Json | null
          platform: string
          platform_name?: string | null
          platform_user_id: string
          platform_username: string
          profile_picture_url?: string | null
          refresh_token?: string | null
          scopes?: string[] | null
          token_expires_at?: string | null
          updated_at?: string | null
          workspace_id: string
        }
        Update: {
          access_token?: string
          created_at?: string | null
          created_by?: string
          id?: string
          is_active?: boolean | null
          metadata?: Json | null
          platform?: string
          platform_name?: string | null
          platform_user_id?: string
          platform_username?: string
          profile_picture_url?: string | null
          refresh_token?: string | null
          scopes?: string[] | null
          token_expires_at?: string | null
          updated_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_integrations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      social_publishing_logs: {
        Row: {
          created_at: string | null
          error_message: string | null
          id: string
          integration_id: string
          metadata: Json | null
          platform: string
          platform_permalink: string | null
          platform_post_id: string | null
          post_id: string
          published_at: string | null
          status: string
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          integration_id: string
          metadata?: Json | null
          platform: string
          platform_permalink?: string | null
          platform_post_id?: string | null
          post_id: string
          published_at?: string | null
          status: string
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          integration_id?: string
          metadata?: Json | null
          platform?: string
          platform_permalink?: string | null
          platform_post_id?: string | null
          post_id?: string
          published_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_publishing_logs_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "social_integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_publishing_logs_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          admin_response: string | null
          category: Database["public"]["Enums"]["support_ticket_category"]
          created_at: string
          id: string
          message: string
          priority: Database["public"]["Enums"]["support_ticket_priority"]
          responded_at: string | null
          responded_by: string | null
          status: Database["public"]["Enums"]["support_ticket_status"]
          subject: string
          updated_at: string
          user_id: string
          user_replied_at: string | null
          user_reply: string | null
        }
        Insert: {
          admin_response?: string | null
          category?: Database["public"]["Enums"]["support_ticket_category"]
          created_at?: string
          id?: string
          message: string
          priority?: Database["public"]["Enums"]["support_ticket_priority"]
          responded_at?: string | null
          responded_by?: string | null
          status?: Database["public"]["Enums"]["support_ticket_status"]
          subject: string
          updated_at?: string
          user_id: string
          user_replied_at?: string | null
          user_reply?: string | null
        }
        Update: {
          admin_response?: string | null
          category?: Database["public"]["Enums"]["support_ticket_category"]
          created_at?: string
          id?: string
          message?: string
          priority?: Database["public"]["Enums"]["support_ticket_priority"]
          responded_at?: string | null
          responded_by?: string | null
          status?: Database["public"]["Enums"]["support_ticket_status"]
          subject?: string
          updated_at?: string
          user_id?: string
          user_replied_at?: string | null
          user_reply?: string | null
        }
        Relationships: []
      }
      trial_notifications: {
        Row: {
          created_at: string
          id: string
          notification_type: string
          sent_at: string
          trial_ends_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notification_type: string
          sent_at?: string
          trial_ends_at: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          notification_type?: string
          sent_at?: string
          trial_ends_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_acquisition_events: {
        Row: {
          campaign: string | null
          created_at: string
          event_type: string
          id: string
          ip_address: unknown
          medium: string | null
          page_url: string | null
          referrer_url: string | null
          session_id: string | null
          source: string | null
          user_agent: string | null
          user_id: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_id: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
        }
        Insert: {
          campaign?: string | null
          created_at?: string
          event_type: string
          id?: string
          ip_address?: unknown
          medium?: string | null
          page_url?: string | null
          referrer_url?: string | null
          session_id?: string | null
          source?: string | null
          user_agent?: string | null
          user_id?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_id?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Update: {
          campaign?: string | null
          created_at?: string
          event_type?: string
          id?: string
          ip_address?: unknown
          medium?: string | null
          page_url?: string | null
          referrer_url?: string | null
          session_id?: string | null
          source?: string | null
          user_agent?: string | null
          user_id?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_id?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Relationships: []
      }
      user_benefits: {
        Row: {
          activated_at: string
          benefit_tier: Database["public"]["Enums"]["benefit_tier"]
          benefit_type: string
          benefit_value: Json
          created_at: string
          expires_at: string | null
          id: string
          metadata: Json | null
          revoked_at: string | null
          source_referral_id: string | null
          status: Database["public"]["Enums"]["benefit_status"]
          user_id: string
        }
        Insert: {
          activated_at?: string
          benefit_tier: Database["public"]["Enums"]["benefit_tier"]
          benefit_type: string
          benefit_value: Json
          created_at?: string
          expires_at?: string | null
          id?: string
          metadata?: Json | null
          revoked_at?: string | null
          source_referral_id?: string | null
          status?: Database["public"]["Enums"]["benefit_status"]
          user_id: string
        }
        Update: {
          activated_at?: string
          benefit_tier?: Database["public"]["Enums"]["benefit_tier"]
          benefit_type?: string
          benefit_value?: Json
          created_at?: string
          expires_at?: string | null
          id?: string
          metadata?: Json | null
          revoked_at?: string | null
          source_referral_id?: string | null
          status?: Database["public"]["Enums"]["benefit_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_benefits_source_referral_id_fkey"
            columns: ["source_referral_id"]
            isOneToOne: false
            referencedRelation: "referrals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_benefits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      workspace_analytics_snapshots: {
        Row: {
          active_users_count: number
          created_at: string
          created_by: string
          id: string
          posts_by_platform: Json
          posts_by_status: Json
          posts_by_type: Json
          snapshot_date: string
          total_posts_lifetime: number
          total_storage_used_mb: number
          workspace_id: string
        }
        Insert: {
          active_users_count?: number
          created_at?: string
          created_by: string
          id?: string
          posts_by_platform?: Json
          posts_by_status?: Json
          posts_by_type?: Json
          snapshot_date: string
          total_posts_lifetime?: number
          total_storage_used_mb?: number
          workspace_id: string
        }
        Update: {
          active_users_count?: number
          created_at?: string
          created_by?: string
          id?: string
          posts_by_platform?: Json
          posts_by_status?: Json
          posts_by_type?: Json
          snapshot_date?: string
          total_posts_lifetime?: number
          total_storage_used_mb?: number
          workspace_id?: string
        }
        Relationships: []
      }
      workspace_members: {
        Row: {
          id: string
          invited_at: string | null
          invited_by: string | null
          user_id: string
          workspace_id: string
          workspace_role: string
        }
        Insert: {
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          user_id: string
          workspace_id: string
          workspace_role?: string
        }
        Update: {
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          user_id?: string
          workspace_id?: string
          workspace_role?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          autodelete_days: number | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          metrics_visibility: Database["public"]["Enums"]["metrics_visibility_enum"]
          name: string
          owner_id: string
          platforms: Database["public"]["Enums"]["platform_type"][] | null
          updated_at: string
        }
        Insert: {
          autodelete_days?: number | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          metrics_visibility?: Database["public"]["Enums"]["metrics_visibility_enum"]
          name: string
          owner_id: string
          platforms?: Database["public"]["Enums"]["platform_type"][] | null
          updated_at?: string
        }
        Update: {
          autodelete_days?: number | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          metrics_visibility?: Database["public"]["Enums"]["metrics_visibility_enum"]
          name?: string
          owner_id?: string
          platforms?: Database["public"]["Enums"]["platform_type"][] | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      aggregate_monthly_analytics: {
        Args: {
          target_month: number
          target_workspace_id: string
          target_year: number
        }
        Returns: boolean
      }
      append_media_url_to_post: {
        Args: { new_media_url: string; target_post_id: string }
        Returns: undefined
      }
      bytea_to_text: { Args: { data: string }; Returns: string }
      calculate_referral_tier: {
        Args: { referrer_uuid: string }
        Returns: Json
      }
      calculate_user_stats_before_deletion: {
        Args: { target_user_id: string }
        Returns: Json
      }
      can_manage_workspace_members: {
        Args: { user_uuid: string; workspace_uuid: string }
        Returns: boolean
      }
      change_user_role_secure: {
        Args: {
          changed_by: string
          ip_address?: unknown
          new_role: string
          reason?: string
          target_user_id: string
          user_agent?: string
        }
        Returns: boolean
      }
      cleanup_stuck_uploads: { Args: never; Returns: number }
      create_workspace: {
        Args: {
          workspace_description?: string
          workspace_image_url?: string
          workspace_name: string
        }
        Returns: string
      }
      debug_post_deletion: { Args: { target_post_id: string }; Returns: Json }
      detect_acquisition_source: {
        Args: { referrer_url: string; utm_source: string }
        Returns: string
      }
      encrypt_sensitive_data: { Args: { data: string }; Returns: string }
      extract_r2_key_from_url: { Args: { media_url: string }; Returns: string }
      generate_referral_code: { Args: { user_uuid: string }; Returns: string }
      get_billing_summary: {
        Args: { target_user_id?: string }
        Returns: {
          billing_banner: string
          created_at: string
          currency: string
          id: string
          subscription_status: string
        }[]
      }
      get_pending_media_deletions: {
        Args: never
        Returns: {
          deleted_at: string
          id: string
          r2_key: string
          workspace_id: string
        }[]
      }
      get_supabase_config: {
        Args: never
        Returns: {
          service_key: string
          url: string
        }[]
      }
      get_user_billing_info: {
        Args: never
        Returns: {
          billing_banner: string
          created_at: string
          currency: string
          id: string
          subscription_status: string
        }[]
      }
      get_user_entitlements: {
        Args: { user_uuid?: string }
        Returns: {
          billing_banner: string
          email: string
          features: Json
          grace_until: string
          is_early_adopter: boolean
          max_guest_memberships: number
          max_owned_workspaces: number
          past_due_since: string
          plan_tier: Database["public"]["Enums"]["plan_tier_enum"]
          post_expiry_days: number
          storage_total_mb: number
          storage_used_mb: number
          subscription_status: string
          user_id: string
        }[]
      }
      get_workspace_members_safe: {
        Args: { workspace_uuid: string }
        Returns: {
          email: string
          user_id: string
          username: string
        }[]
      }
      http: {
        Args: { request: Database["public"]["CompositeTypes"]["http_request"] }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
        SetofOptions: {
          from: "http_request"
          to: "http_response"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      http_delete:
        | {
            Args: { uri: string }
            Returns: Database["public"]["CompositeTypes"]["http_response"]
            SetofOptions: {
              from: "*"
              to: "http_response"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: { content: string; content_type: string; uri: string }
            Returns: Database["public"]["CompositeTypes"]["http_response"]
            SetofOptions: {
              from: "*"
              to: "http_response"
              isOneToOne: true
              isSetofReturn: false
            }
          }
      http_get:
        | {
            Args: { uri: string }
            Returns: Database["public"]["CompositeTypes"]["http_response"]
            SetofOptions: {
              from: "*"
              to: "http_response"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: { data: Json; uri: string }
            Returns: Database["public"]["CompositeTypes"]["http_response"]
            SetofOptions: {
              from: "*"
              to: "http_response"
              isOneToOne: true
              isSetofReturn: false
            }
          }
      http_head: {
        Args: { uri: string }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
        SetofOptions: {
          from: "*"
          to: "http_response"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      http_header: {
        Args: { field: string; value: string }
        Returns: Database["public"]["CompositeTypes"]["http_header"]
        SetofOptions: {
          from: "*"
          to: "http_header"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      http_list_curlopt: {
        Args: never
        Returns: {
          curlopt: string
          value: string
        }[]
      }
      http_patch: {
        Args: { content: string; content_type: string; uri: string }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
        SetofOptions: {
          from: "*"
          to: "http_response"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      http_post:
        | {
            Args: { content: string; content_type: string; uri: string }
            Returns: Database["public"]["CompositeTypes"]["http_response"]
            SetofOptions: {
              from: "*"
              to: "http_response"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: { data: Json; uri: string }
            Returns: Database["public"]["CompositeTypes"]["http_response"]
            SetofOptions: {
              from: "*"
              to: "http_response"
              isOneToOne: true
              isSetofReturn: false
            }
          }
      http_put: {
        Args: { content: string; content_type: string; uri: string }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
        SetofOptions: {
          from: "*"
          to: "http_response"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      http_reset_curlopt: { Args: never; Returns: boolean }
      http_set_curlopt: {
        Args: { curlopt: string; value: string }
        Returns: boolean
      }
      is_current_user_admin: { Args: never; Returns: boolean }
      is_current_user_admin_secure: { Args: never; Returns: boolean }
      is_user_admin: { Args: { user_uuid?: string }; Returns: boolean }
      is_workspace_owner: {
        Args: { user_uuid: string; workspace_uuid: string }
        Returns: boolean
      }
      log_admin_action: {
        Args: {
          action_type: string
          details?: Json
          ip_address?: unknown
          target_id: string
          target_resource: string
          user_agent?: string
        }
        Returns: undefined
      }
      log_admin_session_activity: {
        Args: {
          admin_id: string
          ip_addr?: unknown
          user_agent_string?: string
        }
        Returns: undefined
      }
      log_role_change: {
        Args: {
          changed_by: string
          ip_address?: unknown
          new_role: string
          old_role: string
          reason?: string
          target_user_id: string
          user_agent?: string
        }
        Returns: undefined
      }
      secure_billing_update: {
        Args: {
          new_billing_banner?: string
          new_subscription_status?: string
          target_user_id: string
        }
        Returns: boolean
      }
      test_60day_trial_activation: {
        Args: never
        Returns: {
          details: string
          result: string
          test_name: string
        }[]
      }
      text_to_bytea: { Args: { data: string }; Returns: string }
      trigger_media_cleanup: { Args: never; Returns: undefined }
      urlencode:
        | { Args: { data: Json }; Returns: string }
        | {
            Args: { string: string }
            Returns: {
              error: true
            } & "Could not choose the best candidate function between: public.urlencode(string => bytea), public.urlencode(string => varchar). Try renaming the parameters or the function itself in the database so function overloading can be resolved"
          }
        | {
            Args: { string: string }
            Returns: {
              error: true
            } & "Could not choose the best candidate function between: public.urlencode(string => bytea), public.urlencode(string => varchar). Try renaming the parameters or the function itself in the database so function overloading can be resolved"
          }
      user_belongs_to_workspace: {
        Args: { user_uuid: string; workspace_uuid: string }
        Returns: boolean
      }
      validate_billing_access: {
        Args: { target_user_id: string }
        Returns: boolean
      }
      validate_profile_email: {
        Args: { profile_email: string; profile_user_id: string }
        Returns: boolean
      }
      validate_username: { Args: { username_input: string }; Returns: boolean }
    }
    Enums: {
      benefit_status: "active" | "expired" | "revoked"
      benefit_tier:
        | "tier_1_base"
        | "tier_2_discount"
        | "tier_3_referral_credit"
        | "tier_4_storage_bonus"
      metrics_visibility_enum: "owner_only" | "all" | "disabled"
      plan_tier_enum: "free" | "pro" | "premium" | "business"
      platform_type:
        | "Instagram"
        | "Facebook"
        | "LinkedIn"
        | "YT"
        | "X"
        | "Pinterest"
        | "Reddit"
      post_status:
        | "Pendente"
        | "Revisado"
        | "Reprovado"
        | "Aprovado"
        | "Programado"
        | "Postado"
        | "Rascunho"
        | "Uploading"
        | "Erro"
      post_type: "Feed" | "Carrossel" | "Reels" | "Storys"
      referral_status:
        | "pending"
        | "converted"
        | "active"
        | "expired"
        | "credited"
      support_ticket_category: "billing" | "technical" | "general" | "account"
      support_ticket_priority: "low" | "medium" | "high" | "urgent"
      support_ticket_status: "open" | "in_progress" | "closed"
    }
    CompositeTypes: {
      http_header: {
        field: string | null
        value: string | null
      }
      http_request: {
        method: unknown
        uri: string | null
        headers: Database["public"]["CompositeTypes"]["http_header"][] | null
        content_type: string | null
        content: string | null
      }
      http_response: {
        status: number | null
        content_type: string | null
        headers: Database["public"]["CompositeTypes"]["http_header"][] | null
        content: string | null
      }
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      benefit_status: ["active", "expired", "revoked"],
      benefit_tier: [
        "tier_1_base",
        "tier_2_discount",
        "tier_3_referral_credit",
        "tier_4_storage_bonus",
      ],
      metrics_visibility_enum: ["owner_only", "all", "disabled"],
      plan_tier_enum: ["free", "pro", "premium", "business"],
      platform_type: [
        "Instagram",
        "Facebook",
        "LinkedIn",
        "YT",
        "X",
        "Pinterest",
        "Reddit",
      ],
      post_status: [
        "Pendente",
        "Revisado",
        "Reprovado",
        "Aprovado",
        "Programado",
        "Postado",
        "Rascunho",
        "Uploading",
        "Erro",
      ],
      post_type: ["Feed", "Carrossel", "Reels", "Storys"],
      referral_status: [
        "pending",
        "converted",
        "active",
        "expired",
        "credited",
      ],
      support_ticket_category: ["billing", "technical", "general", "account"],
      support_ticket_priority: ["low", "medium", "high", "urgent"],
      support_ticket_status: ["open", "in_progress", "closed"],
    },
  },
} as const
