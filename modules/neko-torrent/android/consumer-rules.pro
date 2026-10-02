# libtorrent4j's SWIG bindings are called by native code. R8 cannot see those
# calls and otherwise removes callbacks such as alert_notify_callback.on_alert.
-keep class org.libtorrent4j.swig.** { *; }
