document.addEventListener("DOMContentLoaded", function () {
    window.history.replaceState({}, document.title, window.location.pathname);


    fetch('https://api.ipify.org?format=json') // Fetch public IP from ipify API
        .then(response => response.json())
        .then(data => {
            let clientIp = data.ip; // Get client's actual public IP
            updateDashboard(clientIp);
        })
        .catch(error => console.error("Failed to fetch IP:", error));



    document.getElementById("logout").addEventListener("click", () => {
        fetch('/csrf-token', { credentials: 'include' })
            .then(response => response.json())
            .then(data => {
                const csrfToken = data.csrfToken;
                fetch("/logout", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "X-CSRF-Token": csrfToken // Include CSRF token
                    },
                    credentials: 'include', // Ensure cookies are sent
                })
                    .then(response => {
                        if (!response.ok) {
                            throw new Error("Server error: " + response.status);
                        }
                        return response.json();
                    })
                    .then(data => {
                        if (data.success) {
                            sessionStorage.removeItem("loggedIn"); // Clear session storage
                            window.location.href = "./index.html"; // Redirect to login page
                            console.log("Run: Logout successful!");
                        } else {
                            console.error("Logout failed:", data.message);
                            alert("Logout failed: " + data.message);
                        }
                    })
                    .catch(error => {
                        console.error("Logout Error:", error);
                        alert("Logout failed. Server not reachable.");
                    });
            })
            .catch(error => console.error("Error fetching CSRF token:", error));

    });

    fetch('/csrf-token', { credentials: 'include' })
        .then(response => response.json())
        .then(data => {
            const csrfToken = data.csrfToken;
            fetch("/topMoneyHolders", {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                    "X-CSRF-Token": csrfToken
                },
                credentials: 'include',
            })
                .then(response => response.json())
                .then(data => {
                    // console.log(data.topPlayers);
                    // const allData = data.topPlayers;
                    let topPlayers = Array.isArray(data.topPlayers) ? data.topPlayers : JSON.parse(data.topPlayers || "[]");

                    topPlayers.forEach((ele, i) => {
                        let id = "playerTop" + i;
                        let element = document.getElementById(id);
                        if (element) {
                            element.innerHTML = `${i + 1}. ${ele.name} <span class="badge rounded-pill text-bg-success">$${Math.round(ele.money).toLocaleString()}</span>`;
                        } else {
                            console.warn(`Element with ID '${id}' not found.`);
                        }
                    });
                })
                .catch(error => console.error("Error fetching top money holders:", error));
        })
        .catch(error => console.error("Error fetching CSRF token:", error));


    fetch('/csrf-token', { credentials: 'include' })
        .then(response => response.json())
        .then(data => {
            const csrfToken = data.csrfToken;
            fetch("/getBanData", {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                    "X-CSRF-Token": csrfToken
                },
                credentials: 'include',
            })
                .then(response => response.json())
                .then(data => {
                    console.log(data.data);
                    const parentElement = document.getElementById("banList");
                    parentElement.innerHTML = ""; // Clear previous content

                    data.data.forEach(ban => {
                        const banItem = document.createElement("div");
                        banItem.classList.add("ban-item");

                        banItem.innerHTML = `
                                <div class="d-flex justify-content-start align-items-stretch text-bg-light rounded p-2 mt-2">
                                <div class="text-bg-secondary rounded d-flex justify-content-center align-items-center" style="width: 20%;">
                                    <img src="./img/face.png" alt="Minecraft Player Face" style="width: auto; height: 3em;">
                                </div>
                                <div class="ms-3">
                                    <p class="m-0">Name: ${ban.player || "Unknown"}</p>
                                    <p class="m-0">Reason: ${ban.reason || "No reason provided"}</p>
                                    <p class="m-0">Timestamp: ${formatTimestamp(ban.timestamp) || "Unknown"}</p>
                                </div>
                            </div>
                            `;

                        parentElement.appendChild(banItem);
                    });
                })
                .catch(error => console.error("Error fetching top money holders:", error));
        })
        .catch(error => console.error("Error fetching CSRF token:", error));


    document.getElementById("download").addEventListener("click", () => {
        window.location.href = "./apks/minecraft-1-21-62.apk";
    });


});
document.getElementById("copyIP").addEventListener("click", () => {
    var ipField = document.getElementById("serverIPJava");
    ipField.select();
    ipField.setSelectionRange(0, 99999); // For mobile support
    navigator.clipboard.writeText(ipField.value);
    // alert("Copied: " + ipField.value);
});

document.getElementById("copyIP2").addEventListener("click", () => {
    var ipField = document.getElementById("serverIPBedrock");
    ipField.select();
    ipField.setSelectionRange(0, 99999); // For mobile support
    navigator.clipboard.writeText(ipField.value);
    // alert("Copied: " + ipField.value);
});


function updateDashboard(clientIp) {
    // Fetch CSRF token first
    fetch('/csrf-token', { credentials: 'include' })
        .then(response => response.json())
        .then(data => {
            const csrfToken = data.csrfToken;

            // Now make the request to /dashboard with the CSRF token
            fetch("/dashboard", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-CSRF-Token": csrfToken // Include CSRF token
                },
                credentials: 'include', // Ensure cookies are sent
                body: JSON.stringify({ ip: clientIp })
            })
                .then(response => response.json())
                .then(data => {
                    if (!data.success) {
                        alert(data.message);
                        window.location.href = "index.html"; // Redirect if not logged in
                        return;
                    }

                    const uuid = data.uuid;
                    SwitchConn(data.wifi);
                    addNetworkSwitchListener(data.name);


                    function getProfile() {
                        fetch('/csrf-token', { credentials: 'include' })
                            .then(response => response.json())
                            .then(data => {
                                const csrfToken = data.csrfToken;

                                fetch("/getData", {
                                    method: "POST",
                                    headers: {
                                        "Content-Type": "application/json",
                                        "X-CSRF-Token": csrfToken
                                    },
                                    credentials: 'include', // Ensure cookies are sent
                                    body: JSON.stringify({ uuid: uuid })
                                })
                                    .then(response => response.json())
                                    .then(data => {
                                        if (data.error) {

                                            fetch('/csrf-token', { credentials: 'include' })
                                                .then(response => response.json())
                                                .then(data => {
                                                    const csrfToken = data.csrfToken;

                                                    fetch("/update-uuid", {
                                                        method: "POST",
                                                        headers: {
                                                            "Content-Type": "application/json",
                                                            "X-CSRF-Token": csrfToken
                                                        },
                                                        body: JSON.stringify({ id: 1, name: "Jayesh" })
                                                    })
                                                        .then(response => response.json())
                                                        .then(data => { console.log("Response:", data) })
                                                        .catch(error => console.error("Error:", error));
                                                })
                                                .catch(error => console.error("Error fetching CSRF token:", error));

                                            const reloadNotice = `<span class="badge text-bg-danger"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-exclamation-triangle-fill" viewBox="0 0 16 16">
                                                <path d="M8.982 1.566a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767zM8 5c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 5.995A.905.905 0 0 1 8 5m.002 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2"/>
                                                </svg> Refresh page</span>`;
                                            document.getElementById("playerName").innerHTML = `Ingame Name: ${reloadNotice}`;
                                            document.getElementById("nameBlinker").style.display = "none";
                                            document.getElementById("playerMoney").innerHTML = `Ingame Money: ${reloadNotice}`;
                                        } else {

                                            document.getElementById("playerName").innerHTML = `Ingame Name: ${data.data["last-account-name"]}`;
                                            document.getElementById("nameBlinker").style.display = "none";
                                            document.getElementById("moneyBlinker").style.display = "none";
                                            let money = Math.round(data.data.money) > 0 ? Math.round(data.data.money) : 0;
                                            document.getElementById("playerMoney").innerHTML = `Ingame Money: <span class="badge text-bg-success color-white">${"$ " + money.toLocaleString()}</span> 
                                                <svg xmlns="http://www.w3.org/2000/svg" id="refreshBalance" style="cursor: pointer;" width="16" height="16" fill="currentColor" class="bi bi-arrow-clockwise" viewBox="0 0 16 16">
                                                <path fill-rule="evenodd" d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2z"/>
                                                <path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466"/>
                                                </svg>`;

                                            document.getElementById("refreshBalance").addEventListener("click", () => {
                                                document.getElementById("moneyBlinker").style.display = "block";
                                                document.getElementById("playerMoney").innerHTML = `Ingame Money: `;
                                                setTimeout(() => {
                                                    getProfile();
                                                }, 1000);
                                            });

                                        }
                                    })
                                    .catch(error => console.error("Error:", error));
                            })
                            .catch(error => console.error("Error fetching CSRF token:", error));
                    }

                    //to avoide double code
                    getProfile();

                    let statusText = data.whitelisted ? "You are whitelisted!" : "Not whitelisted! Contact Admin.";
                    let mainColor = data.whitelisted ? "m-0 text-bg-success rounded px-2" : "m-0 text-bg-danger rounded px-2";
                    // let mainColor = data.whitelisted ? "green" : "red";
                    let logo = data.whitelisted ? `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-check-circle-fill" viewBox="0 0 16 16">
                        <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0m-3.97-3.03a.75.75 0 0 0-1.08.022L7.477 9.417 5.384 7.323a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-.01-1.05z"/>
                        </svg>` : `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-x-circle" viewBox="0 0 16 16">
                        <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14m0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16"/>
                        <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708"/>
                        </svg>`;

                    document.getElementById("whiteListChecker2").className = mainColor;
                    document.getElementById("whiteListChecker2").innerHTML = logo + " " + statusText;

                    if (data.ip_updated) {
                        setTimeout(() => {
                            document.getElementById("accConnecter2").innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-check-circle-fill" viewBox="0 0 16 16">
                                <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0m-3.97-3.03a.75.75 0 0 0-1.08.022L7.477 9.417 5.384 7.323a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-.01-1.05z"/>
                                </svg>  Device connected with your minecraft account`;
                            document.getElementById("accConnecter2").className = "m-0 text-bg-success rounded px-2 mt-3";
                        }, 800);
                    } else {
                        setTimeout(() => {
                            document.getElementById("accConnecter2").innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-check-circle-fill" viewBox="0 0 16 16">
                                <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0m-3.97-3.03a.75.75 0 0 0-1.08.022L7.477 9.417 5.384 7.323a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-.01-1.05z"/>
                                </svg>  Device Not Verified`;
                            document.getElementById("accConnecter2").className = "m-0 text-bg-danger rounded px-2 mt-3";
                        }, 800);
                    }
                })
                .catch(error => console.error('Error fetching whitelist status:', error));
        })
        .catch(error => console.error("Error fetching CSRF token:", error));
}

function SwitchConn(flag) {
    if (flag) {
        document.getElementById("wifiSwitch").className = "rounded-pill text-bg-light text-center";
        document.getElementById("dataSwitch").className = "rounded-pill text-bg-dark text-center";
    } else {
        document.getElementById("wifiSwitch").className = "rounded-pill text-bg-dark text-center";
        document.getElementById("dataSwitch").className = "rounded-pill text-bg-light text-center";
    }
}

function addNetworkSwitchListener(name) {
    document.getElementById("networkSwitch").addEventListener("click", () => {
        fetch('/csrf-token', { credentials: 'include' })
            .then(response => response.json())
            .then(data => {
                const csrfToken = data.csrfToken;
                fetch("/switchNetwork", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "X-CSRF-Token": csrfToken // Include CSRF token
                    },
                    credentials: 'include', // Ensure cookies are sent
                    body: JSON.stringify({ username: name }),
                })
                    .then((response) => response.json())
                    .then((data) => SwitchConn(data.wifi))
                    .catch((error) => console.error("Error:", error));
            })
            .catch(error => console.error("Error fetching CSRF token:", error));
    });
}

function formatTimestamp(ts) {
    const date = new Date(ts);
    return date.toLocaleString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }).replace(" ", "") +
           " " + date.toLocaleDateString("en-US");
}
