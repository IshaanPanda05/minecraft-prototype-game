import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;
import java.util.concurrent.Executors;

public final class Main {
    private static final Map<String, String> CONTENT_TYPES = Map.of(
            ".html", "text/html; charset=utf-8",
            ".css", "text/css; charset=utf-8",
            ".js", "text/javascript; charset=utf-8",
            ".json", "application/json; charset=utf-8",
            ".png", "image/png",
            ".svg", "image/svg+xml",
            ".ico", "image/x-icon");

    private Main() {}

    public static void main(String[] args) throws IOException {
        int port = args.length == 0 ? 8080 : Integer.parseInt(args[0]);
        Path webRoot = Path.of("web").toRealPath();
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", port), 0);
        server.createContext("/", exchange -> serveFile(exchange, webRoot));
        server.setExecutor(Executors.newCachedThreadPool());
        server.start();
        System.out.println("Block World is running at http://localhost:" + port);
        System.out.println("Press Ctrl+C to stop the server.");
    }

    private static void serveFile(HttpExchange exchange, Path webRoot) throws IOException {
        if (!"GET".equals(exchange.getRequestMethod())) {
            exchange.getResponseHeaders().set("Allow", "GET");
            exchange.sendResponseHeaders(405, -1);
            exchange.close();
            return;
        }

        String requestPath = exchange.getRequestURI().getPath();
        if ("/".equals(requestPath)) {
            requestPath = "/index.html";
        }

        Path requestedFile = webRoot.resolve(requestPath.substring(1)).normalize();
        if (!requestedFile.startsWith(webRoot) || !Files.isRegularFile(requestedFile)) {
            exchange.sendResponseHeaders(404, -1);
            exchange.close();
            return;
        }

        Path realFile = requestedFile.toRealPath();
        if (!realFile.startsWith(webRoot)) {
            exchange.sendResponseHeaders(404, -1);
            exchange.close();
            return;
        }

        String fileName = realFile.getFileName().toString();
        int extensionStart = fileName.lastIndexOf('.');
        String extension = extensionStart < 0 ? "" : fileName.substring(extensionStart);
        exchange.getResponseHeaders().set(
                "Content-Type", CONTENT_TYPES.getOrDefault(extension, "application/octet-stream"));
        exchange.getResponseHeaders().set("X-Content-Type-Options", "nosniff");
        byte[] content = Files.readAllBytes(realFile);
        exchange.sendResponseHeaders(200, content.length);
        try (var response = exchange.getResponseBody()) {
            response.write(content);
        }
    }
}
