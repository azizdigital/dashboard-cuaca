// Dashboard Cuaca Aziz - iPad / iPhone app.
// The dashboard is the same web app as https://azizdigital.github.io/dashboard-cuaca/ (always the newest version).
// What the browser cannot do, this shell does, like Electron on the PC: every site opens in its own full browser view,
// so no site can refuse to be shown, and Malaysia-only sites (infobanjir Terengganu, met.gov.my) answer because the
// iPad itself is in Malaysia.
import UIKit
import WebKit

let appURL = URL(string: "https://azizdigital.github.io/dashboard-cuaca/")!
let bg = UIColor(red: 11 / 255, green: 17 / 255, blue: 27 / 255, alpha: 1)

@main
final class AppDelegate: UIResponder, UIApplicationDelegate {
    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        let w = UIWindow(frame: UIScreen.main.bounds)
        w.backgroundColor = bg
        w.rootViewController = DashboardViewController()
        w.makeKeyAndVisible()
        window = w
        return true
    }
}

/// One shared set of cookies and storage for the dashboard and all sites (sign-ins and site settings are kept).
let sharedPool = WKProcessPool()

func makeConfiguration() -> WKWebViewConfiguration {
    let c = WKWebViewConfiguration()
    c.processPool = sharedPool
    c.websiteDataStore = .default()
    c.allowsInlineMediaPlayback = true
    c.mediaTypesRequiringUserActionForPlayback = []
    c.applicationNameForUserAgent = "Version/17.0 Mobile/15E148 Safari/604.1 DashboardCuacaApp/1.0"
    c.defaultWebpagePreferences.preferredContentMode = .recommended
    return c
}

// MARK: - the dashboard

final class DashboardViewController: UIViewController, WKScriptMessageHandler, WKNavigationDelegate, WKUIDelegate {
    private var web: WKWebView!
    private let refresh = UIRefreshControl()
    private var sites: [String: SiteViewController] = [:]
    private let offline = UILabel()

    override var preferredStatusBarStyle: UIStatusBarStyle { .lightContent }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = bg
        let config = makeConfiguration()
        config.userContentController.add(WeakHandler(self), name: "dcOpen")
        web = WKWebView(frame: view.bounds, configuration: config)
        web.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        web.isOpaque = false
        web.backgroundColor = bg
        web.scrollView.backgroundColor = bg
        web.scrollView.contentInsetAdjustmentBehavior = .never
        web.navigationDelegate = self
        web.uiDelegate = self
        web.allowsBackForwardNavigationGestures = false
        refresh.tintColor = .white
        refresh.addTarget(self, action: #selector(reloadDashboard), for: .valueChanged)
        web.scrollView.refreshControl = refresh
        view.addSubview(web)

        offline.text = "Tiada sambungan internet.\nTarik ke bawah untuk cuba lagi."
        offline.numberOfLines = 0
        offline.textAlignment = .center
        offline.textColor = .lightGray
        offline.isHidden = true
        offline.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(offline)
        NSLayoutConstraint.activate([
            offline.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            offline.centerYAnchor.constraint(equalTo: view.centerYAnchor),
            offline.leadingAnchor.constraint(greaterThanOrEqualTo: view.leadingAnchor, constant: 24)
        ])
        web.load(URLRequest(url: appURL))
    }

    @objc private func reloadDashboard() {
        offline.isHidden = true
        if web.url == nil { web.load(URLRequest(url: appURL)) } else { web.reload() }
    }

    /// the web app asks: open this site
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == "dcOpen", let body = message.body as? [String: Any],
              let s = body["url"] as? String, let url = URL(string: s, relativeTo: web.url)?.absoluteURL else { return }
        let id = (body["id"] as? String) ?? url.absoluteString
        let title = (body["title"] as? String) ?? (url.host ?? "")
        openSite(id: id, title: title, url: url)
    }

    func openSite(id: String, title: String, url: URL) {
        let vc: SiteViewController
        if let kept = sites[id] { vc = kept; vc.goIfDifferent(url) } else {
            vc = SiteViewController(title: title, url: url)
            sites[id] = vc
        }
        if presentedViewController != nil { dismiss(animated: false) }
        let nav = UINavigationController(rootViewController: vc)
        nav.modalPresentationStyle = .fullScreen
        nav.navigationBar.barStyle = .black
        nav.navigationBar.tintColor = .white
        nav.isToolbarHidden = false
        nav.toolbar.barStyle = .black
        nav.toolbar.tintColor = .white
        present(nav, animated: true)
    }

    // links the web app opens in a new window (target=_blank, window.open): inside the app too
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = navigationAction.request.url { openSite(id: url.absoluteString, title: url.host ?? "", url: url) }
        return nil
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else { return decisionHandler(.allow) }
        // the dashboard stays the dashboard: a link to another site opens in its own view
        if navigationAction.targetFrame?.isMainFrame == true, let host = url.host, host != appURL.host,
           url.scheme == "http" || url.scheme == "https" {
            openSite(id: url.absoluteString, title: host, url: url)
            return decisionHandler(.cancel)
        }
        if url.scheme == "tel" || url.scheme == "mailto" || url.scheme == "whatsapp" {
            UIApplication.shared.open(url)
            return decisionHandler(.cancel)
        }
        decisionHandler(.allow)
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) { refresh.endRefreshing(); offline.isHidden = true }
    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) { refresh.endRefreshing() }
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        refresh.endRefreshing()
        offline.isHidden = false
    }
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) { webView.reload() }

    // alert / confirm / prompt from the web app (e.g. "use settings from another device?")
    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        let a = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        a.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler() })
        present(a, animated: true)
    }
    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        let a = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        a.addAction(UIAlertAction(title: "Batal", style: .cancel) { _ in completionHandler(false) })
        a.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler(true) })
        present(a, animated: true)
    }
    func webView(_ webView: WKWebView, runJavaScriptTextInputPanelWithPrompt prompt: String, defaultText: String?, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (String?) -> Void) {
        let a = UIAlertController(title: nil, message: prompt, preferredStyle: .alert)
        a.addTextField { $0.text = defaultText }
        a.addAction(UIAlertAction(title: "Batal", style: .cancel) { _ in completionHandler(nil) })
        a.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler(a.textFields?.first?.text) })
        present(a, animated: true)
    }
}

/// avoids a retain cycle between the web view's script handler and the view controller
final class WeakHandler: NSObject, WKScriptMessageHandler {
    weak var target: WKScriptMessageHandler?
    init(_ target: WKScriptMessageHandler) { self.target = target }
    func userContentController(_ c: WKUserContentController, didReceive m: WKScriptMessage) { target?.userContentController(c, didReceive: m) }
}

// MARK: - one site, full screen, with Done / back / forward / reload / open in Safari

final class SiteViewController: UIViewController, WKNavigationDelegate, WKUIDelegate {
    private let startURL: URL
    private var web: WKWebView!
    private let progress = UIProgressView(progressViewStyle: .bar)
    private var observers: [NSKeyValueObservation] = []
    private var backItem: UIBarButtonItem!
    private var forwardItem: UIBarButtonItem!

    init(title: String, url: URL) {
        startURL = url
        super.init(nibName: nil, bundle: nil)
        self.title = title
    }
    required init?(coder: NSCoder) { fatalError("not used") }

    override var preferredStatusBarStyle: UIStatusBarStyle { .lightContent }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = bg
        web = WKWebView(frame: view.bounds, configuration: makeConfiguration())
        web.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        web.navigationDelegate = self
        web.uiDelegate = self
        web.allowsBackForwardNavigationGestures = true
        view.addSubview(web)
        progress.translatesAutoresizingMaskIntoConstraints = false
        progress.progressTintColor = UIColor(red: 0.27, green: 0.55, blue: 1, alpha: 1)
        view.addSubview(progress)
        NSLayoutConstraint.activate([
            progress.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            progress.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            progress.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor)
        ])

        navigationItem.leftBarButtonItem = UIBarButtonItem(title: "Selesai", style: .done, target: self, action: #selector(done))
        navigationItem.rightBarButtonItem = UIBarButtonItem(barButtonSystemItem: .refresh, target: self, action: #selector(reloadPage))
        backItem = UIBarButtonItem(image: UIImage(systemName: "chevron.backward"), style: .plain, target: self, action: #selector(goBack))
        forwardItem = UIBarButtonItem(image: UIImage(systemName: "chevron.forward"), style: .plain, target: self, action: #selector(goForward))
        let home = UIBarButtonItem(image: UIImage(systemName: "house"), style: .plain, target: self, action: #selector(goHome))
        let safari = UIBarButtonItem(image: UIImage(systemName: "safari"), style: .plain, target: self, action: #selector(openInSafari))
        let share = UIBarButtonItem(barButtonSystemItem: .action, target: self, action: #selector(sharePage(_:)))
        let flex = { UIBarButtonItem(barButtonSystemItem: .flexibleSpace, target: nil, action: nil) }
        toolbarItems = [backItem, flex(), forwardItem, flex(), home, flex(), share, flex(), safari]

        observers.append(web.observe(\.estimatedProgress, options: [.new]) { [weak self] w, _ in
            self?.progress.progress = Float(w.estimatedProgress)
            self?.progress.isHidden = w.estimatedProgress >= 1
        })
        observers.append(web.observe(\.canGoBack, options: [.new]) { [weak self] w, _ in self?.backItem.isEnabled = w.canGoBack })
        observers.append(web.observe(\.canGoForward, options: [.new]) { [weak self] w, _ in self?.forwardItem.isEnabled = w.canGoForward })
        backItem.isEnabled = false
        forwardItem.isEnabled = false
        web.load(URLRequest(url: startURL))
    }

    /// the profile moved (e.g. Windy for another place): load the new address
    func goIfDifferent(_ url: URL) {
        guard isViewLoaded, url != startURL else { return }
        web.load(URLRequest(url: url))
    }

    @objc private func done() { dismiss(animated: true) }
    @objc private func reloadPage() { web.reload() }
    @objc private func goBack() { if web.canGoBack { web.goBack() } }
    @objc private func goForward() { if web.canGoForward { web.goForward() } }
    @objc private func goHome() { web.load(URLRequest(url: startURL)) }
    @objc private func openInSafari() { UIApplication.shared.open(web.url ?? startURL) }
    @objc private func sharePage(_ sender: UIBarButtonItem) {
        let a = UIActivityViewController(activityItems: [web.url ?? startURL], applicationActivities: nil)
        a.popoverPresentationController?.barButtonItem = sender
        present(a, animated: true)
    }

    // pop-ups of the site open in the same view
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if navigationAction.targetFrame == nil, let url = navigationAction.request.url { webView.load(URLRequest(url: url)) }
        return nil
    }
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        if let url = navigationAction.request.url, let s = url.scheme, !["http", "https", "about", "blob", "data"].contains(s) {
            UIApplication.shared.open(url)
            return decisionHandler(.cancel)
        }
        decisionHandler(.allow)
    }
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        let e = error as NSError
        if e.code == NSURLErrorCancelled { return }
        let html = "<html><body style='background:#0b111b;color:#ccd;font:17px -apple-system;text-align:center;padding:30vh 24px'>" +
            "<p>Laman tidak dapat dibuka.</p><p style='color:#889'>\(e.localizedDescription)</p></body></html>"
        webView.loadHTMLString(html, baseURL: nil)
    }
    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        let a = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        a.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler() })
        present(a, animated: true)
    }
    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        let a = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        a.addAction(UIAlertAction(title: "Batal", style: .cancel) { _ in completionHandler(false) })
        a.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler(true) })
        present(a, animated: true)
    }
}
