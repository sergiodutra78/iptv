package com.kinetiq.iptv;

import android.app.Activity;
import android.content.Intent;
import android.content.pm.ActivityInfo;
import android.content.res.ColorStateList;
import android.content.res.Configuration;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.text.TextUtils;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.widget.AbsListView;
import android.widget.AdapterView;
import android.widget.BaseAdapter;
import android.widget.ImageButton;
import android.widget.LinearLayout;
import android.widget.ListView;
import android.widget.ProgressBar;
import android.widget.RelativeLayout;
import android.widget.SeekBar;
import android.widget.TextView;

import androidx.annotation.OptIn;
import androidx.media3.common.C;
import androidx.media3.common.MediaItem;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.Player;
import androidx.media3.common.util.UnstableApi;
import androidx.media3.datasource.DefaultHttpDataSource;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory;
import androidx.media3.ui.AspectRatioFrameLayout;
import androidx.media3.ui.PlayerView;

import java.util.ArrayList;
import java.util.Locale;

/**
 * Fullscreen video player backed by ExoPlayer.
 *
 * The provider serves movies/series as MKV and live channels as MPEG-TS, which
 * neither the WebView's <video> nor Android's MediaPlayer can handle properly
 * (MediaPlayer plays them but cannot seek inside a remote MKV, so dragging the
 * timeline just froze). ExoPlayer decodes and seeks both containers.
 *
 * The controls are drawn by hand so live, movies and series all share one bar:
 * title row on top, transport buttons in the middle, timeline at the bottom and
 * an optional list of episodes/channels/movies fading in from the left.
 */
@OptIn(markerClass = UnstableApi.class)
public class PlayerActivity extends Activity {

    public static final String EXTRA_URL = "url";
    public static final String EXTRA_TITLE = "title";
    public static final String EXTRA_SUBTITLE = "subtitle";
    public static final String EXTRA_IS_LIVE = "isLive";
    public static final String EXTRA_HAS_NEXT = "hasNext";
    public static final String EXTRA_HAS_PREV = "hasPrev";
    public static final String EXTRA_PLAYLIST = "playlist";
    public static final String EXTRA_PLAYLIST_INDEX = "playlistIndex";
    public static final String EXTRA_PLAYLIST_OFFSET = "playlistOffset";
    public static final String EXTRA_PANEL_TITLE = "panelTitle";
    public static final String EXTRA_START_POSITION = "startPositionMs";

    public static final String RESULT_REASON = "reason";
    public static final String RESULT_INDEX = "index";
    public static final String RESULT_POSITION = "positionMs";
    public static final String RESULT_DURATION = "durationMs";

    private static final int HIDE_DELAY_MS = 4500;
    private static final int SKIP_MS = 10000;
    private static final int ACCENT = Color.rgb(229, 9, 20);
    private static final int SCRIM = Color.argb(110, 0, 0, 0);
    private static final int PANEL_WIDTH_DP = 290;

    private ExoPlayer mPlayer;
    private PlayerView mPlayerView;
    private ProgressBar mSpinner;

    private RelativeLayout mOverlay;
    private LinearLayout mTopBar;
    private LinearLayout mCenterBar;
    private LinearLayout mBottomBar;
    private LinearLayout mPanel;
    private ListView mPanelList;
    private ImageButton mPlayPauseBtn;
    private ImageButton mPrevBtn;
    private ImageButton mNextBtn;
    private ImageButton mRewBtn;
    private ImageButton mFfBtn;
    private TextView mCurrentTimeText;
    private TextView mTotalTimeText;
    private TextView mLiveBadge;
    private SeekBar mSeekBar;

    private String mUrl;
    private String mTitle = "";
    private String mSubtitle = "";
    private String mPanelTitle = "";
    private boolean mIsLive;
    private boolean mHasNext;
    private boolean mHasPrev;
    private long mStartPositionMs;
    private ArrayList<String> mPlaylist = new ArrayList<>();
    private int mPlaylistIndex = -1;
    private int mPlaylistOffset = 0;

    private boolean mControlsVisible = true;
    private boolean mUserSeeking = false;
    private boolean mFinished = false;
    private final Handler mHandler = new Handler(Looper.getMainLooper());

    private final Runnable mHideRunnable = new Runnable() {
        @Override
        public void run() {
            setControlsVisible(false);
        }
    };

    private final Runnable mProgressRunnable = new Runnable() {
        @Override
        public void run() {
            updateProgress();
            mHandler.postDelayed(this, 500);
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        Bundle b = getIntent().getExtras();
        if (b != null) {
            mUrl = b.getString(EXTRA_URL);
            mTitle = orEmpty(b.getString(EXTRA_TITLE));
            mSubtitle = orEmpty(b.getString(EXTRA_SUBTITLE));
            mPanelTitle = orEmpty(b.getString(EXTRA_PANEL_TITLE));
            mIsLive = b.getBoolean(EXTRA_IS_LIVE, false);
            mHasNext = b.getBoolean(EXTRA_HAS_NEXT, false);
            mHasPrev = b.getBoolean(EXTRA_HAS_PREV, false);
            mStartPositionMs = b.getLong(EXTRA_START_POSITION, 0L);
            ArrayList<String> list = b.getStringArrayList(EXTRA_PLAYLIST);
            if (list != null) mPlaylist = list;
            mPlaylistIndex = b.getInt(EXTRA_PLAYLIST_INDEX, -1);
            mPlaylistOffset = b.getInt(EXTRA_PLAYLIST_OFFSET, 0);
        }

        setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE);

        RelativeLayout root = new RelativeLayout(this);
        root.setBackgroundColor(Color.BLACK);

        mPlayerView = new PlayerView(this);
        mPlayerView.setUseController(false);
        mPlayerView.setResizeMode(AspectRatioFrameLayout.RESIZE_MODE_FIT);
        mPlayerView.setShutterBackgroundColor(Color.BLACK);
        mPlayerView.setLayoutParams(new RelativeLayout.LayoutParams(
                RelativeLayout.LayoutParams.MATCH_PARENT, RelativeLayout.LayoutParams.MATCH_PARENT));
        root.addView(mPlayerView);

        mSpinner = new ProgressBar(this);
        mSpinner.setIndeterminate(true);
        RelativeLayout.LayoutParams spinnerParams = new RelativeLayout.LayoutParams(
                RelativeLayout.LayoutParams.WRAP_CONTENT, RelativeLayout.LayoutParams.WRAP_CONTENT);
        spinnerParams.addRule(RelativeLayout.CENTER_IN_PARENT);
        mSpinner.setLayoutParams(spinnerParams);
        root.addView(mSpinner);

        buildOverlay(root);

        setContentView(root);

        // Needs the decor view, so only after setContentView.
        hideSystemBars();

        startPlayback();
    }

    // ---------------------------------------------------------------- overlay

    private void buildOverlay(RelativeLayout root) {
        mOverlay = new RelativeLayout(this);
        mOverlay.setLayoutParams(new RelativeLayout.LayoutParams(
                RelativeLayout.LayoutParams.MATCH_PARENT, RelativeLayout.LayoutParams.MATCH_PARENT));
        mOverlay.setBackgroundColor(SCRIM);
        mOverlay.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                setControlsVisible(!mControlsVisible);
            }
        });

        buildTopBar();
        buildBottomBar();
        buildPanel();
        buildCenterBar();

        root.addView(mOverlay);
        mOverlay.bringToFront();
    }

    private void buildTopBar() {
        mTopBar = new LinearLayout(this);
        mTopBar.setId(View.generateViewId());
        mTopBar.setOrientation(LinearLayout.HORIZONTAL);
        mTopBar.setGravity(Gravity.CENTER_VERTICAL);
        RelativeLayout.LayoutParams params = new RelativeLayout.LayoutParams(
                RelativeLayout.LayoutParams.MATCH_PARENT, RelativeLayout.LayoutParams.WRAP_CONTENT);
        params.addRule(RelativeLayout.ALIGN_PARENT_TOP);
        params.setMargins(dp(14), dp(14), dp(14), 0);
        mTopBar.setLayoutParams(params);

        ImageButton closeBtn = iconButton(android.R.drawable.ic_menu_close_clear_cancel, dp(38));
        closeBtn.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                finishWith("close", -1);
            }
        });
        mTopBar.addView(closeBtn);

        LinearLayout titleColumn = new LinearLayout(this);
        titleColumn.setOrientation(LinearLayout.VERTICAL);
        LinearLayout.LayoutParams columnParams =
                new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f);
        columnParams.setMargins(dp(10), 0, dp(10), 0);
        titleColumn.setLayoutParams(columnParams);

        TextView titleText = new TextView(this);
        titleText.setText(mTitle);
        titleText.setTextColor(Color.WHITE);
        titleText.setTextSize(TypedValue.COMPLEX_UNIT_SP, 15);
        titleText.setSingleLine(true);
        titleText.setEllipsize(TextUtils.TruncateAt.END);
        titleColumn.addView(titleText);

        TextView subtitleText = new TextView(this);
        subtitleText.setText(mSubtitle);
        subtitleText.setTextColor(Color.argb(190, 255, 255, 255));
        subtitleText.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12);
        subtitleText.setSingleLine(true);
        subtitleText.setEllipsize(TextUtils.TruncateAt.END);
        subtitleText.setVisibility(mSubtitle.length() > 0 ? View.VISIBLE : View.GONE);
        titleColumn.addView(subtitleText);

        mTopBar.addView(titleColumn);

        mLiveBadge = new TextView(this);
        mLiveBadge.setText("EN VIVO");
        mLiveBadge.setTextColor(Color.WHITE);
        mLiveBadge.setTextSize(TypedValue.COMPLEX_UNIT_SP, 11);
        mLiveBadge.setBackgroundColor(ACCENT);
        mLiveBadge.setPadding(dp(8), dp(3), dp(8), dp(3));
        mLiveBadge.setVisibility(mIsLive ? View.VISIBLE : View.GONE);
        mTopBar.addView(mLiveBadge);

        mOverlay.addView(mTopBar);
    }

    private void buildBottomBar() {
        mBottomBar = new LinearLayout(this);
        mBottomBar.setId(View.generateViewId());
        mBottomBar.setOrientation(LinearLayout.VERTICAL);
        RelativeLayout.LayoutParams params = new RelativeLayout.LayoutParams(
                RelativeLayout.LayoutParams.MATCH_PARENT, RelativeLayout.LayoutParams.WRAP_CONTENT);
        params.addRule(RelativeLayout.ALIGN_PARENT_BOTTOM);
        params.setMargins(dp(16), 0, dp(16), dp(14));
        mBottomBar.setLayoutParams(params);

        mSeekBar = new SeekBar(this);
        mSeekBar.setProgressTintList(ColorStateList.valueOf(ACCENT));
        mSeekBar.setThumbTintList(ColorStateList.valueOf(ACCENT));
        mSeekBar.setProgressBackgroundTintList(ColorStateList.valueOf(Color.argb(70, 255, 255, 255)));
        mSeekBar.setSecondaryProgressTintList(ColorStateList.valueOf(Color.argb(110, 255, 255, 255)));
        mSeekBar.setMax(1000);
        mSeekBar.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener() {
            @Override
            public void onProgressChanged(SeekBar seekBar, int progress, boolean fromUser) {
                if (fromUser) {
                    mCurrentTimeText.setText(formatTime(positionForProgress(progress)));
                }
            }

            @Override
            public void onStartTrackingTouch(SeekBar seekBar) {
                mUserSeeking = true;
                mHandler.removeCallbacks(mHideRunnable);
            }

            @Override
            public void onStopTrackingTouch(SeekBar seekBar) {
                mUserSeeking = false;
                seekTo(positionForProgress(seekBar.getProgress()));
                scheduleHide();
            }
        });
        mBottomBar.addView(mSeekBar);

        LinearLayout timesRow = new LinearLayout(this);
        timesRow.setOrientation(LinearLayout.HORIZONTAL);

        mCurrentTimeText = timeLabel("0:00");
        timesRow.addView(mCurrentTimeText);

        View spacer = new View(this);
        spacer.setLayoutParams(new LinearLayout.LayoutParams(0, 1, 1f));
        timesRow.addView(spacer);

        mTotalTimeText = timeLabel("0:00");
        timesRow.addView(mTotalTimeText);

        mBottomBar.addView(timesRow);
        mBottomBar.setVisibility(mIsLive ? View.GONE : View.VISIBLE);
        mOverlay.addView(mBottomBar);
    }

    /** Episodes / channels / movies, fading in over the left edge of the video. */
    private void buildPanel() {
        if (mPlaylist.isEmpty()) return;

        mPanel = new LinearLayout(this);
        mPanel.setId(View.generateViewId());
        mPanel.setOrientation(LinearLayout.VERTICAL);
        mPanel.setBackground(new GradientDrawable(
                GradientDrawable.Orientation.LEFT_RIGHT,
                new int[]{Color.argb(242, 0, 0, 0), Color.argb(196, 0, 0, 0), Color.TRANSPARENT}));
        RelativeLayout.LayoutParams params = new RelativeLayout.LayoutParams(
                dp(PANEL_WIDTH_DP), RelativeLayout.LayoutParams.MATCH_PARENT);
        params.addRule(RelativeLayout.ALIGN_PARENT_LEFT);
        params.addRule(RelativeLayout.BELOW, mTopBar.getId());
        params.addRule(RelativeLayout.ABOVE, mBottomBar.getId());
        mPanel.setLayoutParams(params);

        TextView header = new TextView(this);
        header.setText(mPanelTitle.length() > 0 ? mPanelTitle.toUpperCase(Locale.getDefault()) : "LISTA");
        header.setTextColor(Color.argb(170, 255, 255, 255));
        header.setTextSize(TypedValue.COMPLEX_UNIT_SP, 11);
        header.setPadding(dp(16), dp(10), dp(16), dp(6));
        mPanel.addView(header);

        mPanelList = new ListView(this);
        mPanelList.setDivider(null);
        mPanelList.setSelector(new android.graphics.drawable.ColorDrawable(Color.TRANSPARENT));
        mPanelList.setCacheColorHint(Color.TRANSPARENT);
        mPanelList.setVerticalScrollBarEnabled(false);
        mPanelList.setLayoutParams(new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f));
        mPanelList.setAdapter(new PlaylistAdapter());
        mPanelList.setOnItemClickListener(new AdapterView.OnItemClickListener() {
            @Override
            public void onItemClick(AdapterView<?> parent, View view, int position, long id) {
                if (position == mPlaylistIndex) {
                    setControlsVisible(false);
                    return;
                }
                finishWith("index", mPlaylistOffset + position);
            }
        });
        mPanelList.setOnScrollListener(new AbsListView.OnScrollListener() {
            @Override
            public void onScrollStateChanged(AbsListView view, int scrollState) {
                scheduleHide();
            }

            @Override
            public void onScroll(AbsListView view, int first, int visible, int total) {
            }
        });
        mPanel.addView(mPanelList);

        mOverlay.addView(mPanel);

        if (mPlaylistIndex >= 0) {
            final int target = Math.max(0, mPlaylistIndex - 2);
            mPanelList.post(new Runnable() {
                @Override
                public void run() {
                    mPanelList.setSelection(target);
                }
            });
        }
    }

    private void buildCenterBar() {
        mCenterBar = new LinearLayout(this);
        mCenterBar.setOrientation(LinearLayout.HORIZONTAL);
        mCenterBar.setGravity(Gravity.CENTER);
        RelativeLayout.LayoutParams params;
        if (mPanel != null) {
            // Keep the transport buttons centred in whatever room the list leaves.
            params = new RelativeLayout.LayoutParams(
                    RelativeLayout.LayoutParams.MATCH_PARENT, RelativeLayout.LayoutParams.WRAP_CONTENT);
            params.addRule(RelativeLayout.CENTER_VERTICAL);
            params.addRule(RelativeLayout.RIGHT_OF, mPanel.getId());
        } else {
            params = new RelativeLayout.LayoutParams(
                    RelativeLayout.LayoutParams.WRAP_CONTENT, RelativeLayout.LayoutParams.WRAP_CONTENT);
            params.addRule(RelativeLayout.CENTER_IN_PARENT);
        }
        mCenterBar.setLayoutParams(params);

        mPrevBtn = iconButton(android.R.drawable.ic_media_previous, dp(42));
        mPrevBtn.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                finishWith("prev", -1);
            }
        });
        mPrevBtn.setVisibility(mHasPrev ? View.VISIBLE : View.GONE);
        addSpaced(mCenterBar, mPrevBtn);

        mRewBtn = iconButton(android.R.drawable.ic_media_rew, dp(42));
        mRewBtn.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                seekBy(-SKIP_MS);
            }
        });
        mRewBtn.setVisibility(mIsLive ? View.GONE : View.VISIBLE);
        addSpaced(mCenterBar, mRewBtn);

        mPlayPauseBtn = iconButton(android.R.drawable.ic_media_pause, dp(58));
        mPlayPauseBtn.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                togglePlayback();
            }
        });
        addSpaced(mCenterBar, mPlayPauseBtn);

        mFfBtn = iconButton(android.R.drawable.ic_media_ff, dp(42));
        mFfBtn.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                seekBy(SKIP_MS);
            }
        });
        mFfBtn.setVisibility(mIsLive ? View.GONE : View.VISIBLE);
        addSpaced(mCenterBar, mFfBtn);

        mNextBtn = iconButton(android.R.drawable.ic_media_next, dp(42));
        mNextBtn.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                finishWith("next", -1);
            }
        });
        mNextBtn.setVisibility(mHasNext ? View.VISIBLE : View.GONE);
        addSpaced(mCenterBar, mNextBtn);

        mOverlay.addView(mCenterBar);
    }

    private class PlaylistAdapter extends BaseAdapter {
        @Override
        public int getCount() {
            return mPlaylist.size();
        }

        @Override
        public Object getItem(int position) {
            return mPlaylist.get(position);
        }

        @Override
        public long getItemId(int position) {
            return position;
        }

        @Override
        public View getView(int position, View convertView, ViewGroup parent) {
            LinearLayout row;
            if (convertView instanceof LinearLayout) {
                row = (LinearLayout) convertView;
            } else {
                row = new LinearLayout(PlayerActivity.this);
                row.setOrientation(LinearLayout.HORIZONTAL);
                row.setGravity(Gravity.CENTER_VERTICAL);
                row.setPadding(dp(12), dp(9), dp(12), dp(9));

                View marker = new View(PlayerActivity.this);
                marker.setLayoutParams(new LinearLayout.LayoutParams(dp(3), dp(22)));
                row.addView(marker);

                TextView label = new TextView(PlayerActivity.this);
                LinearLayout.LayoutParams labelParams = new LinearLayout.LayoutParams(
                        LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
                labelParams.setMargins(dp(10), 0, 0, 0);
                label.setLayoutParams(labelParams);
                label.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
                label.setSingleLine(true);
                label.setEllipsize(TextUtils.TruncateAt.END);
                row.addView(label);
            }

            boolean current = position == mPlaylistIndex;
            row.getChildAt(0).setBackgroundColor(current ? ACCENT : Color.TRANSPARENT);
            TextView label = (TextView) row.getChildAt(1);
            label.setText(mPlaylist.get(position));
            label.setTextColor(current ? Color.WHITE : Color.argb(180, 255, 255, 255));
            return row;
        }
    }

    // ------------------------------------------------------------- playback

    private void startPlayback() {
        DefaultHttpDataSource.Factory httpFactory = new DefaultHttpDataSource.Factory()
                .setUserAgent("KinetiQ-IPTV/1.0 (Android)")
                .setAllowCrossProtocolRedirects(true)
                .setConnectTimeoutMs(20000)
                .setReadTimeoutMs(20000);

        mPlayer = new ExoPlayer.Builder(this)
                .setMediaSourceFactory(new DefaultMediaSourceFactory(httpFactory))
                .build();
        mPlayerView.setPlayer(mPlayer);
        mPlayer.setHandleAudioBecomingNoisy(true);
        mPlayer.addListener(new Player.Listener() {
            @Override
            public void onPlaybackStateChanged(int state) {
                mSpinner.setVisibility(state == Player.STATE_BUFFERING ? View.VISIBLE : View.GONE);
                if (state == Player.STATE_READY) {
                    refreshLiveState();
                }
                if (state == Player.STATE_ENDED) {
                    finishWith("ended", -1);
                }
            }

            @Override
            public void onIsPlayingChanged(boolean isPlaying) {
                mPlayPauseBtn.setImageResource(isPlaying
                        ? android.R.drawable.ic_media_pause
                        : android.R.drawable.ic_media_play);
                if (isPlaying) {
                    scheduleHide();
                } else {
                    mHandler.removeCallbacks(mHideRunnable);
                    setControlsVisible(true);
                }
            }

            @Override
            public void onPlayerError(PlaybackException error) {
                Intent intent = new Intent();
                intent.putExtra(RESULT_REASON, "error");
                intent.putExtra("message", error.getErrorCodeName() + ": " + error.getMessage());
                setResult(RESULT_CANCELED, intent);
                mFinished = true;
                finish();
            }
        });

        try {
            mPlayer.setMediaItem(MediaItem.fromUri(mUrl));
            if (mStartPositionMs > 0 && !mIsLive) {
                mPlayer.seekTo(mStartPositionMs);
            }
            mPlayer.prepare();
            mPlayer.setPlayWhenReady(true);
        } catch (Throwable t) {
            // Never take the whole app down because one stream can't be opened.
            Intent intent = new Intent();
            intent.putExtra("message", String.valueOf(t.getMessage()));
            setResult(RESULT_CANCELED, intent);
            mFinished = true;
            finish();
            return;
        }

        mHandler.post(mProgressRunnable);
        setControlsVisible(true);
    }

    /** A stream with no known duration is live no matter what the app guessed. */
    private void refreshLiveState() {
        boolean live = mIsLive || mPlayer.getDuration() == C.TIME_UNSET || mPlayer.isCurrentMediaItemLive();
        if (live == mIsLive) return;
        mIsLive = live;
        mLiveBadge.setVisibility(View.VISIBLE);
        mRewBtn.setVisibility(View.GONE);
        mFfBtn.setVisibility(View.GONE);
        mBottomBar.setVisibility(View.GONE);
    }

    private void togglePlayback() {
        if (mPlayer == null) return;
        if (mPlayer.isPlaying()) {
            mPlayer.pause();
        } else {
            mPlayer.play();
        }
    }

    private void seekBy(int deltaMs) {
        if (mPlayer == null || mIsLive) return;
        seekTo(mPlayer.getCurrentPosition() + deltaMs);
        scheduleHide();
    }

    private void seekTo(long positionMs) {
        if (mPlayer == null) return;
        long duration = mPlayer.getDuration();
        long target = Math.max(0, positionMs);
        if (duration != C.TIME_UNSET && target > duration) target = duration;
        mPlayer.seekTo(target);
        // A seek into an unbuffered region stops playback until it refills;
        // ask for playback again so it never sits there frozen.
        mPlayer.setPlayWhenReady(true);
        updateProgress();
    }

    private long positionForProgress(int progress) {
        long duration = mPlayer == null ? 0 : mPlayer.getDuration();
        if (duration == C.TIME_UNSET || duration <= 0) return 0;
        return duration * progress / 1000;
    }

    private void updateProgress() {
        if (mPlayer == null || mIsLive) return;
        long duration = mPlayer.getDuration();
        if (duration == C.TIME_UNSET || duration <= 0) return;
        long position = mPlayer.getCurrentPosition();
        if (!mUserSeeking) {
            mSeekBar.setProgress((int) (position * 1000 / duration));
            mCurrentTimeText.setText(formatTime(position));
        }
        mSeekBar.setSecondaryProgress((int) (mPlayer.getBufferedPosition() * 1000 / duration));
        mTotalTimeText.setText(formatTime(duration));
    }

    // --------------------------------------------------------------- chrome

    private void setControlsVisible(boolean visible) {
        mControlsVisible = visible;
        int visibility = visible ? View.VISIBLE : View.GONE;
        mTopBar.setVisibility(visibility);
        mCenterBar.setVisibility(visibility);
        mBottomBar.setVisibility(mIsLive ? View.GONE : visibility);
        if (mPanel != null) mPanel.setVisibility(visibility);
        mOverlay.setBackgroundColor(visible ? SCRIM : Color.TRANSPARENT);
        if (visible) {
            scheduleHide();
        } else {
            mHandler.removeCallbacks(mHideRunnable);
        }
    }

    private void scheduleHide() {
        mHandler.removeCallbacks(mHideRunnable);
        if (mPlayer != null && !mPlayer.isPlaying()) return;
        mHandler.postDelayed(mHideRunnable, HIDE_DELAY_MS);
    }

    // setSystemUiVisibility is ignored for apps targeting SDK 35+, so use the
    // WindowInsetsController API to get a real immersive fullscreen video.
    private void hideSystemBars() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            getWindow().setDecorFitsSystemWindows(false);
            WindowInsetsController controller = getWindow().getInsetsController();
            if (controller != null) {
                controller.hide(WindowInsets.Type.systemBars());
                controller.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            }
        } else {
            getWindow().getDecorView().setSystemUiVisibility(
                    View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                            | View.SYSTEM_UI_FLAG_FULLSCREEN
                            | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                            | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                            | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                            | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
        }
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemBars();
    }

    @Override
    public void onConfigurationChanged(Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
    }

    // ------------------------------------------------------------ lifecycle

    private void finishWith(String reason, int index) {
        if (mFinished) return;
        mFinished = true;
        Intent intent = new Intent();
        intent.putExtra(RESULT_REASON, reason);
        intent.putExtra(RESULT_INDEX, index);
        intent.putExtra(RESULT_POSITION, mPlayer == null ? 0L : mPlayer.getCurrentPosition());
        long duration = mPlayer == null ? C.TIME_UNSET : mPlayer.getDuration();
        intent.putExtra(RESULT_DURATION, duration == C.TIME_UNSET ? 0L : duration);
        setResult(Activity.RESULT_OK, intent);
        finish();
    }

    @Override
    public void onBackPressed() {
        finishWith("close", -1);
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (mPlayer != null) mPlayer.pause();
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        mHandler.removeCallbacks(mHideRunnable);
        mHandler.removeCallbacks(mProgressRunnable);
        if (mPlayer != null) {
            mPlayer.release();
            mPlayer = null;
        }
    }

    // --------------------------------------------------------------- helpers

    private ImageButton iconButton(int drawableRes, int size) {
        ImageButton button = new ImageButton(this);
        button.setImageResource(drawableRes);
        button.setColorFilter(Color.WHITE);
        button.setBackgroundColor(Color.TRANSPARENT);
        button.setScaleType(android.widget.ImageView.ScaleType.FIT_CENTER);
        button.setPadding(dp(6), dp(6), dp(6), dp(6));
        button.setLayoutParams(new LinearLayout.LayoutParams(size, size));
        return button;
    }

    private void addSpaced(LinearLayout parent, View child) {
        LinearLayout.LayoutParams lp = (LinearLayout.LayoutParams) child.getLayoutParams();
        lp.setMargins(dp(14), 0, dp(14), 0);
        child.setLayoutParams(lp);
        parent.addView(child);
    }

    private TextView timeLabel(String text) {
        TextView view = new TextView(this);
        view.setText(text);
        view.setTextColor(Color.WHITE);
        view.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12);
        return view;
    }

    private int dp(int value) {
        return (int) TypedValue.applyDimension(
                TypedValue.COMPLEX_UNIT_DIP, value, getResources().getDisplayMetrics());
    }

    private static String orEmpty(String value) {
        return value == null ? "" : value;
    }

    private static String formatTime(long millis) {
        long totalSeconds = millis / 1000;
        long seconds = totalSeconds % 60;
        long minutes = (totalSeconds / 60) % 60;
        long hours = totalSeconds / 3600;
        if (hours > 0) {
            return String.format(Locale.US, "%d:%02d:%02d", hours, minutes, seconds);
        }
        return String.format(Locale.US, "%d:%02d", minutes, seconds);
    }
}
