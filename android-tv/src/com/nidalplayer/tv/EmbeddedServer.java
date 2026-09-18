package com.nidalplayer.tv;

import java.io.*;
import java.net.*;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class EmbeddedServer {

    private final int mPort;
    private final String mToken;
    private final MainActivity mActivity;
    private ServerSocket mServerSocket;
    private boolean mRunning = false;
    private final ExecutorService mThreadPool = Executors.newCachedThreadPool();
    private volatile String mCurrentStateJson = "{\"playback\":{},\"playlists\":[],\"channels\":[],\"movies\":[],\"series\":[],\"categories\":{}}";

    public void updateState(String stateJson) {
        if (stateJson != null) {
            this.mCurrentStateJson = stateJson;
        }
    }

    public void updatePlayback(String title, String type, double positionSec, double durationSec, boolean paused) {
        try {
            org.json.JSONObject root = new org.json.JSONObject(mCurrentStateJson);
            org.json.JSONObject pb = root.optJSONObject("playback");
            if (pb == null) pb = new org.json.JSONObject();
            if (title != null && !title.isEmpty()) pb.put("title", title);
            if (type != null && !type.isEmpty()) pb.put("type", type);
            pb.put("currentTime", positionSec);
            pb.put("position", positionSec);
            pb.put("duration", durationSec);
            pb.put("paused", paused);
            pb.put("status", paused ? "paused" : "playing");
            pb.put("isFs", true);
            root.put("playback", pb);
            this.mCurrentStateJson = root.toString();
        } catch (Exception ignored) {}
    }

    public EmbeddedServer(int port, String token, MainActivity activity) {
        this.mPort = port;
        this.mToken = token;
        this.mActivity = activity;
    }

    public void start() {
        mRunning = true;
        new Thread(new Runnable() {
            @Override
            public void run() {
                try {
                    mServerSocket = new ServerSocket(mPort);
                    while (mRunning) {
                        final Socket socket = mServerSocket.accept();
                        mThreadPool.execute(new Runnable() {
                            @Override
                            public void run() {
                                handleClient(socket);
                            }
                        });
                    }
                } catch (Exception e) {
                    if (mRunning) e.printStackTrace();
                }
            }
        }).start();
    }

    public void stop() {
        mRunning = false;
        try {
            if (mServerSocket != null) mServerSocket.close();
            mThreadPool.shutdownNow();
        } catch (Exception ignored) {}
    }

    private boolean isPrivateAddress(InetAddress addr) {
        if (addr == null) return true;
        return addr.isLoopbackAddress() || addr.isSiteLocalAddress() || addr.isLinkLocalAddress() || addr.isAnyLocalAddress();
    }

    private void handleClient(Socket socket) {
        try {
            BufferedReader reader = new BufferedReader(new InputStreamReader(socket.getInputStream()));
            OutputStream out = socket.getOutputStream();

            String line = reader.readLine();
            if (line == null) {
                socket.close();
                return;
            }

            String[] parts = line.split(" ");
            String method = parts.length > 0 ? parts[0] : "GET";
            String requestTarget = parts.length > 1 ? parts[1] : "/";
            String path = requestTarget;
            String requestToken = "";
            int queryStart = requestTarget.indexOf('?');
            if (queryStart >= 0) {
                String query = requestTarget.substring(queryStart + 1);
                path = requestTarget.substring(0, queryStart);
                for (String part : query.split("&")) {
                    if (part.startsWith("token=")) requestToken = URLDecoder.decode(part.substring(6), "UTF-8");
                }
            }

            boolean isLan = isPrivateAddress(socket.getInetAddress());
            boolean apiRequest = path.startsWith("/api/");

            // 1. Standalone mobile remote & Fast Playlist Sender UI
            if (path.equals("/") || path.equals("/remote")) {
                InputStream is = mActivity.getAssets().open("www/remote.html");
                ByteArrayOutputStream buffer = new ByteArrayOutputStream();
                int nRead;
                byte[] data = new byte[4096];
                while ((nRead = is.read(data, 0, data.length)) != -1) {
                    buffer.write(data, 0, nRead);
                }
                is.close();
                String html = new String(buffer.toByteArray(), "UTF-8");
                html = html.replace("<head>", "<head><script>window.SERVER_INJECTED_TOKEN = \"" + mToken + "\";</script>");
                byte[] responseBytes = html.getBytes("UTF-8");

                PrintWriter writer = new PrintWriter(out);
                writer.print("HTTP/1.1 200 OK\r\n");
                writer.print("Content-Type: text/html; charset=utf-8\r\n");
                writer.print("Access-Control-Allow-Origin: *\r\n");
                writer.print("Content-Length: " + responseBytes.length + "\r\n");
                writer.print("Connection: close\r\n\r\n");
                writer.flush();
                out.write(responseBytes);
                out.flush();
            } else if (path.equals("/api/pair")) {
                String respJson = "{\"ok\":true,\"token\":\"" + mToken + "\",\"port\":" + mPort + "}";
                byte[] responseBytes = respJson.getBytes("UTF-8");
                PrintWriter writer = new PrintWriter(out);
                writer.print("HTTP/1.1 200 OK\r\n");
                writer.print("Content-Type: application/json; charset=utf-8\r\n");
                writer.print("Access-Control-Allow-Origin: *\r\n");
                writer.print("Access-Control-Allow-Headers: *\r\n");
                writer.print("Access-Control-Allow-Methods: GET, POST, OPTIONS\r\n");
                writer.print("Content-Length: " + responseBytes.length + "\r\n");
                writer.print("Connection: close\r\n\r\n");
                writer.flush();
                out.write(responseBytes);
                out.flush();
            } else if (path.equals("/api/state") || path.equals("/api/status")) {
                byte[] responseBytes = (mCurrentStateJson != null ? mCurrentStateJson : "{}").getBytes("UTF-8");
                PrintWriter writer = new PrintWriter(out);
                writer.print("HTTP/1.1 200 OK\r\n");
                writer.print("Content-Type: application/json; charset=utf-8\r\n");
                writer.print("Access-Control-Allow-Origin: *\r\n");
                writer.print("Access-Control-Allow-Headers: *\r\n");
                writer.print("Access-Control-Allow-Methods: GET, POST, OPTIONS\r\n");
                writer.print("Content-Length: " + responseBytes.length + "\r\n");
                writer.print("Connection: close\r\n\r\n");
                writer.flush();
                out.write(responseBytes);
                out.flush();
            } else if (method.equalsIgnoreCase("OPTIONS")) {
                PrintWriter writer = new PrintWriter(out);
                writer.print("HTTP/1.1 204 No Content\r\n");
                writer.print("Access-Control-Allow-Origin: *\r\n");
                writer.print("Access-Control-Allow-Headers: *\r\n");
                writer.print("Access-Control-Allow-Methods: GET, POST, OPTIONS\r\n");
                writer.print("Connection: close\r\n\r\n");
                writer.flush();
            } else if (path.equals("/api/send-playlist") && method.equalsIgnoreCase("POST")) {
                int contentLength = 0;
                while ((line = reader.readLine()) != null && !line.isEmpty()) {
                    if (line.toLowerCase().startsWith("content-length:")) {
                        contentLength = Integer.parseInt(line.substring(15).trim());
                    }
                }
                char[] bodyChars = new char[contentLength];
                int totalRead = 0;
                while (totalRead < contentLength) {
                    int r = reader.read(bodyChars, totalRead, contentLength - totalRead);
                    if (r == -1) break;
                    totalRead += r;
                }
                String body = new String(bodyChars);
                mActivity.queuePlaylistImport(body);

                PrintWriter writer = new PrintWriter(out);
                writer.print("HTTP/1.1 200 OK\r\n");
                writer.print("Content-Type: application/json\r\n");
                writer.print("Access-Control-Allow-Origin: *\r\n");
                writer.print("Connection: close\r\n\r\n");
                writer.print("{\"ok\":true,\"message\":\"Playlist sent to Android TV!\"}");
                writer.flush();
            } else if (path.equals("/api/action") && method.equalsIgnoreCase("POST")) {
                int contentLength = 0;
                while ((line = reader.readLine()) != null && !line.isEmpty()) {
                    if (line.toLowerCase().startsWith("content-length:")) {
                        contentLength = Integer.parseInt(line.substring(15).trim());
                    }
                }
                char[] bodyChars = new char[contentLength];
                int totalRead = 0;
                while (totalRead < contentLength) {
                    int r = reader.read(bodyChars, totalRead, contentLength - totalRead);
                    if (r == -1) break;
                    totalRead += r;
                }
                String body = new String(bodyChars);
                mActivity.dispatchRemoteAction(body);

                String responseJson = "{\"ok\":true}";
                try {
                    org.json.JSONObject actObj = new org.json.JSONObject(body);
                    String actType = actObj.optString("type", actObj.optString("action"));
                    if ("fetchSeriesEpisodes".equals(actType)) {
                        String seriesId = actObj.optString("seriesId", "").replaceAll("^series-", "");
                        org.json.JSONObject stateObj = new org.json.JSONObject(mCurrentStateJson);
                        org.json.JSONObject provObj = stateObj.optJSONObject("provider");
                        if (provObj != null && provObj.has("server") && provObj.has("user") && provObj.has("pass")) {
                            String base = provObj.getString("server").replaceAll("/+$", "");
                            String user = provObj.getString("user");
                            String pass = provObj.getString("pass");
                            String urlStr = base + "/player_api.php?username=" + URLEncoder.encode(user, "UTF-8")
                                    + "&password=" + URLEncoder.encode(pass, "UTF-8")
                                    + "&action=get_series_info&series_id=" + URLEncoder.encode(seriesId, "UTF-8");

                            HttpURLConnection conn = (HttpURLConnection) new URL(urlStr).openConnection();
                            conn.setConnectTimeout(8000);
                            conn.setReadTimeout(12000);
                            conn.setRequestProperty("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Nidalplayer/4.0.0");
                            if (conn.getResponseCode() == 200) {
                                BufferedReader inR = new BufferedReader(new InputStreamReader(conn.getInputStream(), "UTF-8"));
                                StringBuilder sb = new StringBuilder();
                                String l;
                                while ((l = inR.readLine()) != null) sb.append(l);
                                inR.close();
                                org.json.JSONObject seriesData = new org.json.JSONObject(sb.toString());
                                org.json.JSONArray epsArr = new org.json.JSONArray();
                                org.json.JSONArray seaArr = new org.json.JSONArray();
                                org.json.JSONObject epsObj = seriesData.optJSONObject("episodes");
                                if (epsObj != null) {
                                    java.util.Iterator<String> sKeys = epsObj.keys();
                                    while (sKeys.hasNext()) {
                                        String sNum = sKeys.next();
                                        int sInt = Integer.parseInt(sNum);
                                        org.json.JSONObject seaItem = new org.json.JSONObject();
                                        seaItem.put("season", sInt);
                                        seaArr.put(seaItem);

                                        org.json.JSONArray sEps = epsObj.optJSONArray(sNum);
                                        if (sEps != null) {
                                            for (int i = 0; i < sEps.length(); i++) {
                                                org.json.JSONObject rawEp = sEps.getJSONObject(i);
                                                String epId = rawEp.optString("id", "");
                                                String ext = rawEp.optString("container_extension", "mp4");
                                                org.json.JSONObject epItem = new org.json.JSONObject();
                                                epItem.put("id", epId);
                                                epItem.put("streamId", epId);
                                                epItem.put("name", rawEp.optString("title", "Episode " + rawEp.optString("episode_num", String.valueOf(i + 1))));
                                                epItem.put("episodeTitle", rawEp.optString("title", "Episode " + rawEp.optString("episode_num", String.valueOf(i + 1))));
                                                epItem.put("episodeNumber", rawEp.optInt("episode_num", i + 1));
                                                epItem.put("season", sInt);
                                                org.json.JSONObject infoObj = rawEp.optJSONObject("info");
                                                int durSec = infoObj != null ? infoObj.optInt("duration_secs", 0) : 0;
                                                epItem.put("duration", durSec > 0 ? (durSec / 60) : 0);
                                                epItem.put("url", base + "/series/" + user + "/" + pass + "/" + epId + "." + ext);
                                                epItem.put("type", "series");
                                                epItem.put("seriesId", seriesId);
                                                epsArr.put(epItem);
                                            }
                                        }
                                    }
                                }
                                org.json.JSONObject res = new org.json.JSONObject();
                                res.put("ok", true);
                                res.put("seasons", seaArr);
                                res.put("episodes", epsArr);
                                responseJson = res.toString();
                            }
                        }
                    }
                } catch (Exception ignored) {}

                PrintWriter writer = new PrintWriter(out);
                writer.print("HTTP/1.1 200 OK\r\n");
                writer.print("Content-Type: application/json\r\n");
                writer.print("Access-Control-Allow-Origin: *\r\n");
                writer.print("Connection: close\r\n\r\n");
                writer.print(responseJson);
                writer.flush();
            } else if (apiRequest && !isLan && !mToken.equals(requestToken)) {
                PrintWriter writer = new PrintWriter(out);
                writer.print("HTTP/1.1 410 Gone\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\nConnection: close\r\n\r\n{\"error\":\"Remote link expired. Scan a new QR code on the TV.\"}");
                writer.flush();
            } else {
                PrintWriter writer = new PrintWriter(out);
                writer.print("HTTP/1.1 404 Not Found\r\n");
                writer.print("Content-Length: 0\r\n");
                writer.print("Connection: close\r\n\r\n");
                writer.flush();
            }

            socket.close();
        } catch (Exception ignored) {}
    }
}
