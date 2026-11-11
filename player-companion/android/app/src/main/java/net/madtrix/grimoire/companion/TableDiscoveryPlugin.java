package net.madtrix.grimoire.companion;

import android.content.Context;
import android.net.nsd.NsdManager;
import android.net.nsd.NsdServiceInfo;
import android.net.wifi.WifiManager;
import android.os.Handler;
import android.os.Looper;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.net.InetAddress;
import java.util.ArrayDeque;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Queue;

/**
 * Découverte instantanée des tables Grimoire sur le Wi-Fi (mDNS / DNS-SD).
 *
 * Grimoire (bureau) annonce le service « _grimoire._tcp ». Ce plugin le cherche
 * avec NsdManager, résout l'adresse IP et le port de chaque table trouvée, puis
 * renvoie la liste à la page web : { tables: [{ name, host, port }] }.
 */
@CapacitorPlugin(name = "TableDiscovery")
public class TableDiscoveryPlugin extends Plugin {

    private static final String SERVICE_TYPE = "_grimoire._tcp.";

    private final Handler handler = new Handler(Looper.getMainLooper());

    @PluginMethod
    public void discover(final PluginCall call) {
        final int timeoutMs = call.getInt("timeoutMs", 2500);
        final Context ctx = getContext();
        final NsdManager nsd = (NsdManager) ctx.getSystemService(Context.NSD_SERVICE);
        if (nsd == null) {
            call.reject("NSD indisponible");
            return;
        }

        // Certains téléphones filtrent le multicast pour économiser la batterie
        WifiManager wifi = (WifiManager) ctx.getApplicationContext().getSystemService(Context.WIFI_SERVICE);
        final WifiManager.MulticastLock lock = wifi != null ? wifi.createMulticastLock("grimoire-mdns") : null;
        if (lock != null) {
            lock.setReferenceCounted(false);
            lock.acquire();
        }

        final Map<String, JSObject> tables = new LinkedHashMap<>();
        final Queue<NsdServiceInfo> toResolve = new ArrayDeque<>();
        final boolean[] resolving = { false };
        final boolean[] finished = { false };

        final NsdManager.DiscoveryListener[] listenerRef = new NsdManager.DiscoveryListener[1];

        final Runnable finish = new Runnable() {
            @Override
            public void run() {
                if (finished[0]) return;
                finished[0] = true;
                try {
                    if (listenerRef[0] != null) nsd.stopServiceDiscovery(listenerRef[0]);
                } catch (Exception ignored) {
                }
                if (lock != null && lock.isHeld()) lock.release();
                JSArray arr = new JSArray();
                for (JSObject t : tables.values()) arr.put(t);
                JSObject ret = new JSObject();
                ret.put("tables", arr);
                call.resolve(ret);
            }
        };

        // NsdManager ne résout qu'un service à la fois (avant Android 14) : file d'attente
        final Runnable[] resolveNext = new Runnable[1];
        resolveNext[0] = new Runnable() {
            @Override
            public void run() {
                if (finished[0] || resolving[0]) return;
                final NsdServiceInfo next = toResolve.poll();
                if (next == null) return;
                resolving[0] = true;
                try {
                    nsd.resolveService(next, new NsdManager.ResolveListener() {
                        @Override
                        public void onResolveFailed(NsdServiceInfo info, int errorCode) {
                            handler.post(new Runnable() {
                                @Override
                                public void run() {
                                    resolving[0] = false;
                                    resolveNext[0].run();
                                }
                            });
                        }

                        @Override
                        public void onServiceResolved(final NsdServiceInfo info) {
                            handler.post(new Runnable() {
                                @Override
                                public void run() {
                                    InetAddress addr = info.getHost();
                                    if (addr != null && addr.getHostAddress() != null && !addr.getHostAddress().contains(":")) {
                                        JSObject t = new JSObject();
                                        t.put("name", info.getServiceName());
                                        t.put("host", addr.getHostAddress());
                                        t.put("port", info.getPort());
                                        tables.put(addr.getHostAddress() + ":" + info.getPort(), t);
                                    }
                                    resolving[0] = false;
                                    resolveNext[0].run();
                                }
                            });
                        }
                    });
                } catch (Exception e) {
                    resolving[0] = false;
                    handler.post(resolveNext[0]);
                }
            }
        };

        listenerRef[0] = new NsdManager.DiscoveryListener() {
            @Override
            public void onStartDiscoveryFailed(String serviceType, int errorCode) {
                handler.post(finish);
            }

            @Override
            public void onStopDiscoveryFailed(String serviceType, int errorCode) {
            }

            @Override
            public void onDiscoveryStarted(String serviceType) {
            }

            @Override
            public void onDiscoveryStopped(String serviceType) {
            }

            @Override
            public void onServiceFound(final NsdServiceInfo info) {
                handler.post(new Runnable() {
                    @Override
                    public void run() {
                        toResolve.add(info);
                        resolveNext[0].run();
                    }
                });
            }

            @Override
            public void onServiceLost(NsdServiceInfo info) {
            }
        };

        try {
            nsd.discoverServices(SERVICE_TYPE, NsdManager.PROTOCOL_DNS_SD, listenerRef[0]);
        } catch (Exception e) {
            if (lock != null && lock.isHeld()) lock.release();
            call.reject("Découverte impossible : " + e.getMessage());
            return;
        }
        handler.postDelayed(finish, timeoutMs);
    }
}
