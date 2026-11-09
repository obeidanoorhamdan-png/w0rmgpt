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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      admin_log: {
        Row: {
          action: string
          created_at: string
          details: string | null
          id: number
        }
        Insert: {
          action: string
          created_at?: string
          details?: string | null
          id?: number
        }
        Update: {
          action?: string
          created_at?: string
          details?: string | null
          id?: number
        }
        Relationships: []
      }
      ai_service_state: {
        Row: {
          paused_at: string
          reason: string
          service: string
          status: number
        }
        Insert: {
          paused_at?: string
          reason: string
          service: string
          status: number
        }
        Update: {
          paused_at?: string
          reason?: string
          service?: string
          status?: number
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          admin_password_hash: string
          announcement: string | null
          api_key_override: string | null
          api_url: string
          daily_credits: number
          default_model: string
          disabled_models: Json
          id: number
          subscriptions_api_enabled: boolean
          system_prompt: string
          tg_admin_ids: string
          tg_bot_chat: boolean
          tg_bot_image: boolean
          tg_bot_username: string
          tg_captcha_enabled: boolean
          tg_channel: string
          tg_channels: Json
          tg_contact: string
          tg_daily_box: Json
          tg_daily_report_at: string
          tg_duplicate_check: boolean
          tg_egg_prizes: Json
          tg_enabled: boolean
          tg_leaderboard_days: number
          tg_maintenance: boolean
          tg_maintenance_text: string
          tg_notify_new_drop: boolean
          tg_paid_plans: Json
          tg_plans: Json
          tg_points_per_day: number
          tg_rate_limit: number
          tg_ref_anti_fake: boolean
          tg_ref_credits: number
          tg_ref_points: number
          tg_ref_purchase_bonus: number
          tg_ref_two_levels: boolean
          tg_reminder_days: number
          tg_require_channels: Json
          tg_spin_prizes: Json
          tg_star_prices: Json
          tg_store_text: string
          tg_streak_bonus: Json
          tg_support_enabled: boolean
          tg_trial_days: number
          tg_trial_plan: string
          tg_usdt_address: string
          tg_usdt_prices: Json
          updated_at: string
        }
        Insert: {
          admin_password_hash: string
          announcement?: string | null
          api_key_override?: string | null
          api_url?: string
          daily_credits?: number
          default_model?: string
          disabled_models?: Json
          id?: number
          subscriptions_api_enabled?: boolean
          system_prompt?: string
          tg_admin_ids?: string
          tg_bot_chat?: boolean
          tg_bot_image?: boolean
          tg_bot_username?: string
          tg_captcha_enabled?: boolean
          tg_channel?: string
          tg_channels?: Json
          tg_contact?: string
          tg_daily_box?: Json
          tg_daily_report_at?: string
          tg_duplicate_check?: boolean
          tg_egg_prizes?: Json
          tg_enabled?: boolean
          tg_leaderboard_days?: number
          tg_maintenance?: boolean
          tg_maintenance_text?: string
          tg_notify_new_drop?: boolean
          tg_paid_plans?: Json
          tg_plans?: Json
          tg_points_per_day?: number
          tg_rate_limit?: number
          tg_ref_anti_fake?: boolean
          tg_ref_credits?: number
          tg_ref_points?: number
          tg_ref_purchase_bonus?: number
          tg_ref_two_levels?: boolean
          tg_reminder_days?: number
          tg_require_channels?: Json
          tg_spin_prizes?: Json
          tg_star_prices?: Json
          tg_store_text?: string
          tg_streak_bonus?: Json
          tg_support_enabled?: boolean
          tg_trial_days?: number
          tg_trial_plan?: string
          tg_usdt_address?: string
          tg_usdt_prices?: Json
          updated_at?: string
        }
        Update: {
          admin_password_hash?: string
          announcement?: string | null
          api_key_override?: string | null
          api_url?: string
          daily_credits?: number
          default_model?: string
          disabled_models?: Json
          id?: number
          subscriptions_api_enabled?: boolean
          system_prompt?: string
          tg_admin_ids?: string
          tg_bot_chat?: boolean
          tg_bot_image?: boolean
          tg_bot_username?: string
          tg_captcha_enabled?: boolean
          tg_channel?: string
          tg_channels?: Json
          tg_contact?: string
          tg_daily_box?: Json
          tg_daily_report_at?: string
          tg_duplicate_check?: boolean
          tg_egg_prizes?: Json
          tg_enabled?: boolean
          tg_leaderboard_days?: number
          tg_maintenance?: boolean
          tg_maintenance_text?: string
          tg_notify_new_drop?: boolean
          tg_paid_plans?: Json
          tg_plans?: Json
          tg_points_per_day?: number
          tg_rate_limit?: number
          tg_ref_anti_fake?: boolean
          tg_ref_credits?: number
          tg_ref_points?: number
          tg_ref_purchase_bonus?: number
          tg_ref_two_levels?: boolean
          tg_reminder_days?: number
          tg_require_channels?: Json
          tg_spin_prizes?: Json
          tg_star_prices?: Json
          tg_store_text?: string
          tg_streak_bonus?: Json
          tg_support_enabled?: boolean
          tg_trial_days?: number
          tg_trial_plan?: string
          tg_usdt_address?: string
          tg_usdt_prices?: Json
          updated_at?: string
        }
        Relationships: []
      }
      generated_images: {
        Row: {
          created_at: string
          id: string
          image_data: string
          prompt: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_data: string
          prompt: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          image_data?: string
          prompt?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "generated_images_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      gift_codes: {
        Row: {
          code: string
          created_at: string
          created_by_key_id: string | null
          days: number
          max_uses: number
          plan: string
          uses: number
        }
        Insert: {
          code: string
          created_at?: string
          created_by_key_id?: string | null
          days?: number
          max_uses?: number
          plan: string
          uses?: number
        }
        Update: {
          code?: string
          created_at?: string
          created_by_key_id?: string | null
          days?: number
          max_uses?: number
          plan?: string
          uses?: number
        }
        Relationships: [
          {
            foreignKeyName: "gift_codes_created_by_key_id_fkey"
            columns: ["created_by_key_id"]
            isOneToOne: false
            referencedRelation: "seller_api_keys"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          created_at: string
          id: string
          model: string | null
          role: string
          thread_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          model?: string | null
          role: string
          thread_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          model?: string | null
          role?: string
          thread_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "threads"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          bonus_credits: number
          created_at: string
          credits: number
          display_name: string | null
          email: string | null
          id: string
          invited_by: string | null
          last_daily_grant: string
          messages_count: number
          plan: string
          plan_expires_at: string | null
          short_id: string
          suspended: boolean
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          bonus_credits?: number
          created_at?: string
          credits?: number
          display_name?: string | null
          email?: string | null
          id: string
          invited_by?: string | null
          last_daily_grant?: string
          messages_count?: number
          plan?: string
          plan_expires_at?: string | null
          short_id?: string
          suspended?: boolean
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          bonus_credits?: number
          created_at?: string
          credits?: number
          display_name?: string | null
          email?: string | null
          id?: string
          invited_by?: string | null
          last_daily_grant?: string
          messages_count?: number
          plan?: string
          plan_expires_at?: string | null
          short_id?: string
          suspended?: boolean
        }
        Relationships: []
      }
      redemptions: {
        Row: {
          code: string
          created_at: string
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      seller_api_keys: {
        Row: {
          active: boolean
          created_at: string
          id: string
          key_hash: string
          name: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          key_hash: string
          name: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          key_hash?: string
          name?: string
        }
        Relationships: []
      }
      tg_badges: {
        Row: {
          description: string
          emoji: string
          key: string
          title: string
        }
        Insert: {
          description?: string
          emoji?: string
          key: string
          title: string
        }
        Update: {
          description?: string
          emoji?: string
          key?: string
          title?: string
        }
        Relationships: []
      }
      tg_bot_log: {
        Row: {
          action: string
          admin_tg_id: number
          created_at: string
          detail: string
          id: number
        }
        Insert: {
          action: string
          admin_tg_id?: number
          created_at?: string
          detail?: string
          id?: number
        }
        Update: {
          action?: string
          admin_tg_id?: number
          created_at?: string
          detail?: string
          id?: number
        }
        Relationships: []
      }
      tg_broadcasts: {
        Row: {
          body: string
          buttons: Json
          created_at: string
          created_by: number
          failed_count: number
          id: string
          image_url: string | null
          scheduled_at: string | null
          sent_at: string | null
          sent_count: number
          status: string
        }
        Insert: {
          body: string
          buttons?: Json
          created_at?: string
          created_by?: number
          failed_count?: number
          id?: string
          image_url?: string | null
          scheduled_at?: string | null
          sent_at?: string | null
          sent_count?: number
          status?: string
        }
        Update: {
          body?: string
          buttons?: Json
          created_at?: string
          created_by?: number
          failed_count?: number
          id?: string
          image_url?: string | null
          scheduled_at?: string | null
          sent_at?: string | null
          sent_count?: number
          status?: string
        }
        Relationships: []
      }
      tg_cart: {
        Row: {
          coupon: string | null
          items: Json
          tg_id: number
          updated_at: string
        }
        Insert: {
          coupon?: string | null
          items?: Json
          tg_id: number
          updated_at?: string
        }
        Update: {
          coupon?: string | null
          items?: Json
          tg_id?: number
          updated_at?: string
        }
        Relationships: []
      }
      tg_contests: {
        Row: {
          created_at: string
          ends_at: string | null
          id: string
          kind: string
          prize_credits: number
          prize_days: number
          prize_plan: string | null
          starts_at: string
          status: string
          title: string
          winners: Json
          winners_count: number
        }
        Insert: {
          created_at?: string
          ends_at?: string | null
          id?: string
          kind?: string
          prize_credits?: number
          prize_days?: number
          prize_plan?: string | null
          starts_at?: string
          status?: string
          title: string
          winners?: Json
          winners_count?: number
        }
        Update: {
          created_at?: string
          ends_at?: string | null
          id?: string
          kind?: string
          prize_credits?: number
          prize_days?: number
          prize_plan?: string | null
          starts_at?: string
          status?: string
          title?: string
          winners?: Json
          winners_count?: number
        }
        Relationships: []
      }
      tg_coupons: {
        Row: {
          active: boolean
          code: string
          created_at: string
          expires_at: string | null
          id: string
          max_uses: number
          percent: number
          uses: number
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          expires_at?: string | null
          id?: string
          max_uses?: number
          percent?: number
          uses?: number
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          max_uses?: number
          percent?: number
          uses?: number
        }
        Relationships: []
      }
      tg_daily_stats: {
        Row: {
          day: string
          drops: number
          entries: number
          new_users: number
          orders: number
          points: number
          revenue_stars: number
          total_users: number
          updated_at: string
        }
        Insert: {
          day: string
          drops?: number
          entries?: number
          new_users?: number
          orders?: number
          points?: number
          revenue_stars?: number
          total_users?: number
          updated_at?: string
        }
        Update: {
          day?: string
          drops?: number
          entries?: number
          new_users?: number
          orders?: number
          points?: number
          revenue_stars?: number
          total_users?: number
          updated_at?: string
        }
        Relationships: []
      }
      tg_drop_entries: {
        Row: {
          amount: number
          choice: number | null
          created_at: string
          drop_id: string
          id: string
          tg_id: number
        }
        Insert: {
          amount?: number
          choice?: number | null
          created_at?: string
          drop_id: string
          id?: string
          tg_id: number
        }
        Update: {
          amount?: number
          choice?: number | null
          created_at?: string
          drop_id?: string
          id?: string
          tg_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "tg_drop_entries_drop_id_fkey"
            columns: ["drop_id"]
            isOneToOne: false
            referencedRelation: "tg_drops"
            referencedColumns: ["id"]
          },
        ]
      }
      tg_drops: {
        Row: {
          answer: string
          channels: Json
          created_at: string
          description: string
          ends_at: string | null
          entry_cost: number
          fairness_hash: string
          fairness_seed: string
          id: string
          kind: string
          last_run_at: string | null
          live_counter: boolean
          max_win_days: number
          message_id: number | null
          min_paid: boolean
          min_points: number
          min_referrals: number
          prize_credits: number
          prize_days: number
          prize_plan: string | null
          question: string
          repeat: string
          require_channel: boolean
          secret_word: string
          starts_at: string
          status: string
          title: string
          vote_options: Json
          winners: Json
          winners_count: number
        }
        Insert: {
          answer?: string
          channels?: Json
          created_at?: string
          description?: string
          ends_at?: string | null
          entry_cost?: number
          fairness_hash?: string
          fairness_seed?: string
          id?: string
          kind?: string
          last_run_at?: string | null
          live_counter?: boolean
          max_win_days?: number
          message_id?: number | null
          min_paid?: boolean
          min_points?: number
          min_referrals?: number
          prize_credits?: number
          prize_days?: number
          prize_plan?: string | null
          question?: string
          repeat?: string
          require_channel?: boolean
          secret_word?: string
          starts_at?: string
          status?: string
          title: string
          vote_options?: Json
          winners?: Json
          winners_count?: number
        }
        Update: {
          answer?: string
          channels?: Json
          created_at?: string
          description?: string
          ends_at?: string | null
          entry_cost?: number
          fairness_hash?: string
          fairness_seed?: string
          id?: string
          kind?: string
          last_run_at?: string | null
          live_counter?: boolean
          max_win_days?: number
          message_id?: number | null
          min_paid?: boolean
          min_points?: number
          min_referrals?: number
          prize_credits?: number
          prize_days?: number
          prize_plan?: string | null
          question?: string
          repeat?: string
          require_channel?: boolean
          secret_word?: string
          starts_at?: string
          status?: string
          title?: string
          vote_options?: Json
          winners?: Json
          winners_count?: number
        }
        Relationships: []
      }
      tg_link_tokens: {
        Row: {
          created_at: string
          expires_at: string
          profile_id: string
          token: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          profile_id: string
          token: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          profile_id?: string
          token?: string
        }
        Relationships: []
      }
      tg_orders: {
        Row: {
          coupon: string | null
          created_at: string
          discount: number
          gift_code: string | null
          id: string
          invoice_id: string | null
          label: string
          method: string
          note: string
          paid_at: string | null
          plan: string
          price: string
          stars: number
          status: string
          tg_id: number
          txid: string | null
          usdt: number
        }
        Insert: {
          coupon?: string | null
          created_at?: string
          discount?: number
          gift_code?: string | null
          id?: string
          invoice_id?: string | null
          label?: string
          method?: string
          note?: string
          paid_at?: string | null
          plan: string
          price?: string
          stars?: number
          status?: string
          tg_id: number
          txid?: string | null
          usdt?: number
        }
        Update: {
          coupon?: string | null
          created_at?: string
          discount?: number
          gift_code?: string | null
          id?: string
          invoice_id?: string | null
          label?: string
          method?: string
          note?: string
          paid_at?: string | null
          plan?: string
          price?: string
          stars?: number
          status?: string
          tg_id?: number
          txid?: string | null
          usdt?: number
        }
        Relationships: []
      }
      tg_point_items: {
        Row: {
          active: boolean
          cost: number
          created_at: string
          description: string
          id: string
          kind: string
          sold: number
          stock: number
          title: string
          value: number
        }
        Insert: {
          active?: boolean
          cost?: number
          created_at?: string
          description?: string
          id?: string
          kind?: string
          sold?: number
          stock?: number
          title: string
          value?: number
        }
        Update: {
          active?: boolean
          cost?: number
          created_at?: string
          description?: string
          id?: string
          kind?: string
          sold?: number
          stock?: number
          title?: string
          value?: number
        }
        Relationships: []
      }
      tg_quiz: {
        Row: {
          correct: number
          created_at: string
          drop_id: string
          id: string
          options: Json
          question: string
        }
        Insert: {
          correct?: number
          created_at?: string
          drop_id: string
          id?: string
          options?: Json
          question: string
        }
        Update: {
          correct?: number
          created_at?: string
          drop_id?: string
          id?: string
          options?: Json
          question?: string
        }
        Relationships: [
          {
            foreignKeyName: "tg_quiz_drop_id_fkey"
            columns: ["drop_id"]
            isOneToOne: false
            referencedRelation: "tg_drops"
            referencedColumns: ["id"]
          },
        ]
      }
      tg_rate: {
        Row: {
          count: number
          key: string
          window_start: string
        }
        Insert: {
          count?: number
          key: string
          window_start?: string
        }
        Update: {
          count?: number
          key?: string
          window_start?: string
        }
        Relationships: []
      }
      tg_staff: {
        Row: {
          created_at: string
          role: string
          tg_id: number
        }
        Insert: {
          created_at?: string
          role?: string
          tg_id: number
        }
        Update: {
          created_at?: string
          role?: string
          tg_id?: number
        }
        Relationships: []
      }
      tg_ticket_msgs: {
        Row: {
          created_at: string
          from_admin: boolean
          id: string
          text: string
          ticket_id: string
        }
        Insert: {
          created_at?: string
          from_admin?: boolean
          id?: string
          text: string
          ticket_id: string
        }
        Update: {
          created_at?: string
          from_admin?: boolean
          id?: string
          text?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tg_ticket_msgs_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tg_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      tg_tickets: {
        Row: {
          admin_tg_id: number | null
          closed_at: string | null
          created_at: string
          id: string
          status: string
          subject: string
          tg_id: number
        }
        Insert: {
          admin_tg_id?: number | null
          closed_at?: string | null
          created_at?: string
          id?: string
          status?: string
          subject?: string
          tg_id: number
        }
        Update: {
          admin_tg_id?: number | null
          closed_at?: string | null
          created_at?: string
          id?: string
          status?: string
          subject?: string
          tg_id?: number
        }
        Relationships: []
      }
      tg_txn: {
        Row: {
          amount: number
          created_at: string
          id: number
          kind: string
          note: string
          tg_id: number
        }
        Insert: {
          amount: number
          created_at?: string
          id?: number
          kind: string
          note?: string
          tg_id: number
        }
        Update: {
          amount?: number
          created_at?: string
          id?: number
          kind?: string
          note?: string
          tg_id?: number
        }
        Relationships: []
      }
      tg_updates: {
        Row: {
          created_at: string
          update_id: number
        }
        Insert: {
          created_at?: string
          update_id: number
        }
        Update: {
          created_at?: string
          update_id?: number
        }
        Relationships: []
      }
      tg_user_badges: {
        Row: {
          badge_key: string
          earned_at: string
          tg_id: number
        }
        Insert: {
          badge_key: string
          earned_at?: string
          tg_id: number
        }
        Update: {
          badge_key?: string
          earned_at?: string
          tg_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "tg_user_badges_badge_key_fkey"
            columns: ["badge_key"]
            isOneToOne: false
            referencedRelation: "tg_badges"
            referencedColumns: ["key"]
          },
        ]
      }
      tg_users: {
        Row: {
          ban_reason: string
          banned: boolean
          captcha_code: string | null
          captcha_expires: string | null
          captcha_verified: boolean
          created_at: string
          dup_key: string | null
          first_name: string | null
          language: string
          last_box_at: string | null
          last_checkin: string | null
          last_seen_at: string
          last_spin_at: string | null
          last_win_at: string | null
          notifications_on: boolean
          paid: boolean
          points: number
          points_earned: number
          points_spent: number
          profile_id: string | null
          referrals: number
          referred_by: number | null
          streak: number
          tg_id: number
          trial_used: boolean
          username: string | null
          win_count: number
          xp: number
        }
        Insert: {
          ban_reason?: string
          banned?: boolean
          captcha_code?: string | null
          captcha_expires?: string | null
          captcha_verified?: boolean
          created_at?: string
          dup_key?: string | null
          first_name?: string | null
          language?: string
          last_box_at?: string | null
          last_checkin?: string | null
          last_seen_at?: string
          last_spin_at?: string | null
          last_win_at?: string | null
          notifications_on?: boolean
          paid?: boolean
          points?: number
          points_earned?: number
          points_spent?: number
          profile_id?: string | null
          referrals?: number
          referred_by?: number | null
          streak?: number
          tg_id: number
          trial_used?: boolean
          username?: string | null
          win_count?: number
          xp?: number
        }
        Update: {
          ban_reason?: string
          banned?: boolean
          captcha_code?: string | null
          captcha_expires?: string | null
          captcha_verified?: boolean
          created_at?: string
          dup_key?: string | null
          first_name?: string | null
          language?: string
          last_box_at?: string | null
          last_checkin?: string | null
          last_seen_at?: string
          last_spin_at?: string | null
          last_win_at?: string | null
          notifications_on?: boolean
          paid?: boolean
          points?: number
          points_earned?: number
          points_spent?: number
          profile_id?: string | null
          referrals?: number
          referred_by?: number | null
          streak?: number
          tg_id?: number
          trial_used?: boolean
          username?: string | null
          win_count?: number
          xp?: number
        }
        Relationships: []
      }
      threads: {
        Row: {
          created_at: string
          id: string
          model: string | null
          pinned: boolean
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          model?: string | null
          pinned?: boolean
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          model?: string | null
          pinned?: boolean
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_daily: { Args: never; Returns: undefined }
      tg_checkout: { Args: { p_tg_id: number }; Returns: Json }
      tg_claim_reward: {
        Args: {
          p_day: string
          p_kind: string
          p_points: number
          p_streak?: number
          p_tg_id: number
        }
        Returns: boolean
      }
      tg_exchange_code: {
        Args: { p_days: number; p_tg_id: number }
        Returns: string
      }
      tg_move_points: {
        Args: {
          p_delta: number
          p_kind: string
          p_note?: string
          p_tg_id: number
        }
        Returns: boolean
      }
      tg_order_action: {
        Args: { p_action: string; p_days: number; p_id: string }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
