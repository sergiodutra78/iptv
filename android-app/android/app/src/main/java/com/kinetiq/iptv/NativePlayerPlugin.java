package com.kinetiq.iptv;

import android.content.Intent;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONException;

import java.util.ArrayList;
import java.util.List;

/**
 * Bridge to {@link PlayerActivity}. The web layer hands over the stream plus the
 * surrounding playlist and gets back why playback ended (close / next / prev /
 * ended / index) and where it stopped.
 */
@CapacitorPlugin(name = "NativePlayer")
public class NativePlayerPlugin extends Plugin {

    @PluginMethod
    public void play(PluginCall call) {
        String url = call.getString("url");
        if (url == null || url.isEmpty()) {
            call.reject("A stream url is required");
            return;
        }

        Intent intent = new Intent(getContext(), PlayerActivity.class);
        intent.putExtra(PlayerActivity.EXTRA_URL, url);
        intent.putExtra(PlayerActivity.EXTRA_TITLE, call.getString("title", ""));
        intent.putExtra(PlayerActivity.EXTRA_SUBTITLE, call.getString("subtitle", ""));
        intent.putExtra(PlayerActivity.EXTRA_PANEL_TITLE, call.getString("panelTitle", ""));
        intent.putExtra(PlayerActivity.EXTRA_IS_LIVE, Boolean.TRUE.equals(call.getBoolean("isLive", false)));
        intent.putExtra(PlayerActivity.EXTRA_HAS_NEXT, Boolean.TRUE.equals(call.getBoolean("hasNext", false)));
        intent.putExtra(PlayerActivity.EXTRA_HAS_PREV, Boolean.TRUE.equals(call.getBoolean("hasPrev", false)));
        // Unbox explicitly: Intent#putExtra would otherwise pick the Serializable
        // overload for the boxed values and getInt/getLong would miss them.
        Integer index = call.getInt("playlistIndex", -1);
        Integer offset = call.getInt("playlistOffset", 0);
        Long startPosition = call.getLong("startPositionMs");
        intent.putExtra(PlayerActivity.EXTRA_PLAYLIST_INDEX, index == null ? -1 : index.intValue());
        intent.putExtra(PlayerActivity.EXTRA_PLAYLIST_OFFSET, offset == null ? 0 : offset.intValue());
        intent.putExtra(PlayerActivity.EXTRA_START_POSITION, startPosition == null ? 0L : startPosition.longValue());

        intent.putStringArrayListExtra(PlayerActivity.EXTRA_PLAYLIST,
                toStringList(call.getArray("playlist", new JSArray())));
        intent.putStringArrayListExtra(PlayerActivity.EXTRA_PLAYLIST_SUBTITLES,
                toStringList(call.getArray("playlistSubtitles", new JSArray())));

        startActivityForResult(call, intent, "playResult");
    }

    private static ArrayList<String> toStringList(JSArray array) {
        ArrayList<String> values = new ArrayList<>();
        try {
            List<Object> parsed = array.toList();
            for (Object item : parsed) {
                values.add(item == null ? "" : String.valueOf(item));
            }
        } catch (JSONException e) {
            // A malformed list is not worth failing playback over.
        }
        return values;
    }

    @ActivityCallback
    private void playResult(PluginCall call, ActivityResult result) {
        if (call == null) return;

        Intent data = result.getData();
        if (result.getResultCode() != android.app.Activity.RESULT_OK) {
            String message = data != null && data.hasExtra("message")
                    ? data.getStringExtra("message")
                    : "Playback error";
            call.reject(message);
            return;
        }

        JSObject ret = new JSObject();
        ret.put("reason", data != null && data.hasExtra(PlayerActivity.RESULT_REASON)
                ? data.getStringExtra(PlayerActivity.RESULT_REASON)
                : "close");
        ret.put("index", data != null ? data.getIntExtra(PlayerActivity.RESULT_INDEX, -1) : -1);
        ret.put("positionMs", data != null ? data.getLongExtra(PlayerActivity.RESULT_POSITION, 0L) : 0L);
        ret.put("durationMs", data != null ? data.getLongExtra(PlayerActivity.RESULT_DURATION, 0L) : 0L);
        call.resolve(ret);
    }
}
