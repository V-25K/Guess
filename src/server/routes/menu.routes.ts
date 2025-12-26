/**
 * Menu Action Routes
 * Handles menu item actions like creating test posts
 */

import { Router, type Request, type Response } from 'express';
import { reddit, context } from '@devvit/web/server';

const router = Router();

/**
 * POST /internal/menu/create-test-post
 * Creates a test post with the Guess The Link game
 */
router.post('/create-test-post', async (_req: Request, res: Response) => {
  try {
    const { subredditName } = context;

    if (!subredditName) {
      res.json({
        showToast: {
          text: 'Error: Subreddit name is required',
          appearance: 'error'
        }
      });
      return;
    }

    // Create a custom post with the webview
    const post = await reddit.submitCustomPost({
      subredditName,
      title: 'Guess The Link - Test Game',
      entry: 'default'
    });

    // Return UIResponse with toast notification
    res.json({
      showToast: {
        text: `Test post created! Opening...`,
        appearance: 'success'
      },
      navigateTo: post
    });
  } catch (error) {
    console.error('Error creating test post:', error);
    res.json({
      showToast: {
        text: `Error: ${error instanceof Error ? error.message : 'Failed to create post'}`,
        appearance: 'error'
      }
    });
  }
});

/**
 * POST /internal/menu/open-profile
 * Opens the app in Profile view (Expanded)
 */
router.post('/open-profile', (_req: Request, res: Response) => {
  res.json({
    ui: {
      webView: {
        url: 'expanded',
        data: { initialView: 'profile' }
      }
    }
  });
});

/**
 * POST /internal/menu/open-leaderboard
 * Opens the app in Leaderboard view (Expanded)
 */
router.post('/open-leaderboard', (_req: Request, res: Response) => {
  res.json({
    ui: {
      webView: {
        url: 'expanded',
        data: { initialView: 'leaderboard' }
      }
    }
  });
});

/**
 * POST /internal/menu/open-create
 * Opens the app in Create Challenge view (Expanded)
 */
router.post('/open-create', (_req: Request, res: Response) => {
  res.json({
    ui: {
      webView: {
        url: 'expanded',
        data: { initialView: 'create' }
      }
    }
  });
});

/**
 * POST /internal/menu/open-awards
 * Opens the app in Awards view (Expanded)
 */
router.post('/open-awards', (_req: Request, res: Response) => {
  res.json({
    ui: {
      webView: {
        url: 'expanded',
        data: { initialView: 'awards' }
      }
    }
  });
});

export { router as menuRoutes };
