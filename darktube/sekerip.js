// ====== CONFIG ======
    const SHEET_CSV = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQnVXYhGBJHAcuOPM3j8quHA4DK_5pLg8vIWzKucISoWQSL1J9OCVom3W7frsub9B3ufIAmpBZw0qsF/pub?output=csv";
    const KEY_FAVS = "darktube_favs_v1";

    // ====== STATE ======
    let RAW = [];
    let VIEW = "home"; // home | favorites
    let FAVS = new Set(JSON.parse(localStorage.getItem(KEY_FAVS) || "[]"));

    // ====== EL REFS ======
    const grid = document.getElementById("grid");
    const favoritesGrid = document.getElementById("favoritesGrid");
    const loading = document.getElementById("loading");
    const q = document.getElementById("q");
    const clearBtn = document.getElementById("clearBtn");
    const sortSel = document.getElementById("sort");
    const statTotal = document.getElementById("statTotal");
    const statUploaders = document.getElementById("statUploaders");
    const activeView = document.getElementById("activeView");
    const refreshBtn = document.getElementById("refresh");
    const toastEl = document.getElementById("toast");
    const modal = document.getElementById("modal");
    const player = document.getElementById("player");
    const closeModalBtn = document.getElementById("closeModal");
    const viewFavsBtn = document.getElementById("viewFavsBtn");
    const sidebarToggleBtn = document.getElementById("sidebarToggleBtn");
    const sidebar = document.getElementById("sidebar");
    const mainContent = document.getElementById("mainContent");

    // ====== HELPERS ======
    const showToast = (msg, ok=false) => {
      toastEl.textContent = msg;
      toastEl.classList.toggle("ok", !!ok);
      toastEl.classList.add("show");
      setTimeout(()=> toastEl.classList.remove("show"), 1400);
    };

    function ytIdFrom(url){
      if(!url) return null;
      const rx = /^.*(?:youtu\.be\/|v\/|embed\/|watch\?v=|&v=)([^#&?]{11}).*/;
      const m = url.match(rx);
      return m ? m[1] : null;
    }
    const thumbFromId = (id) => `https://img.youtube.com/vi/${id}/hqdefault.jpg`;

    function saveFavs(){
      localStorage.setItem(KEY_FAVS, JSON.stringify(Array.from(FAVS)));
    }

    // ====== RENDER ======
    function computeStats(list){
      const total = list.length;
      const uploaders = new Set(list.map(v => (v["Your Username?"] || "Anon")));
      statTotal.textContent = `Total: ${total}`;
      statUploaders.textContent = `Uploader: ${uploaders.size}`;
    }

    function cardTemplate(item){
      const user = item["Your Username?"] || "Anon";
      const url = item["A YouTube Video Link!"] || "";
      const id = ytIdFrom(url);
      const desc = item["description"] || "";
      if(!id) return "";

      const favActive = FAVS.has(id) ? " style='color:#ffd166'" : "";
      return `
        <article class="card" data-id="${id}" data-user="${user.toLowerCase()}">
          <img loading="lazy" src="${thumbFromId(id)}" alt="Thumbnail ${user}" class="thumb" />
          <div class="meta">
            <h3 class="title">${desc ? escapeHTML(desc) : "Video dari " + escapeHTML(user)}</h3>
            <p class="sub">Sender: ${escapeHTML(user)}</p>
            <div class="actions">
              <button class="icon-btn" data-action="play"><i class="fa-solid fa-play"></i> Play</button>
              <button class="icon-btn" data-action="share"><i class="fa-solid fa-share-nodes"></i> Share</button>
              <button class="icon-btn" data-action="fav"><i class="fa-solid fa-star"${favActive}></i> Favorite</button>
              <a class="icon-btn" href="${url}" target="_blank" rel="noopener"><i class="fa-brands fa-youtube"></i> YouTube</a>
            </div>
          </div>
        </article>
      `;
    }

    function applySort(list){
      const mode = sortSel.value;
      if(mode === "username"){
        list.sort((a,b)=> (a["Your Username?"]||"").localeCompare(b["Your Username?"]||""));
      } else if(mode === "random"){
        for(let i=list.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1)); [list[i],list[j]]=[list[j],list[i]];}
      } else { // newest by Timestamp (best-effort)
        list.sort((a,b)=> new Date(b["Timestamp"]||0) - new Date(a["Timestamp"]||0));
      }
      return list;
    }

    function filteredList(){
      const term = (q.value||"").toLowerCase().trim();
      let list = RAW.filter(v => ytIdFrom(v["A YouTube Video Link!"]));
      if(VIEW === "favorites"){
        list = list.filter(v => FAVS.has(ytIdFrom(v["A YouTube Video Link!"])));
      }
      if(term){
        list = list.filter(v => {
          const user = (v["Your Username?"]||"").toLowerCase();
          const desc = (v["description"]||"").toLowerCase();
          const url = (v["A YouTube Video Link!"]||"").toLowerCase();
          return user.includes(term) || desc.includes(term) || url.includes(term);
        });
      }
      return applySort(list);
    }

    function render(){
      const list = filteredList();
      computeStats(list);
      if(VIEW === "favorites"){
        if(!list.length){
          favoritesGrid.innerHTML = `<div class="info">Tidak ada video di Favorites. Klik ⭐ pada video untuk menyimpan.</div>`;
          return;
        }
        favoritesGrid.innerHTML = list.map(cardTemplate).join("");
        bindCardActions(favoritesGrid, list);
      } else {
        if(!list.length){
          grid.innerHTML = `<div class="info">Tidak ada video.</div>`;
          return;
        }
        grid.innerHTML = list.map(cardTemplate).join("");
        bindCardActions(grid, list);
      }
    }

    function bindCardActions(container, list) {
      container.querySelectorAll(".card").forEach(card=>{
        const id = card.dataset.id;
        const url = (RAW.find(v => ytIdFrom(v["A YouTube Video Link!"])===id) || {})["A YouTube Video Link!"] || "";

        card.querySelector('[data-action="play"]').onclick = ()=> openModal(id);
        card.querySelector('[data-action="share"]').onclick = async ()=>{
          try{
            await navigator.clipboard.writeText(url);
            showToast("Link copied!", true);
          }catch(e){
            showToast("Gagal copy link");
          }
        };
        card.querySelector('[data-action="fav"]').onclick = (e)=>{
          if(FAVS.has(id)) FAVS.delete(id); else FAVS.add(id);
          saveFavs();
          // update icon color
          const icon = e.currentTarget.querySelector("i");
          icon.style.color = FAVS.has(id) ? "#ffd166" : "";
          showToast(FAVS.has(id) ? "Added to Favorites" : "Removed from Favorites", true);
          if(VIEW==="favorites") render();
        };
      });
    }

    // ====== MODAL ======
    function openModal(id){
      player.src = `https://www.youtube.com/embed/${id}?autoplay=1&rel=0`;
      modal.classList.add("active");
      modal.setAttribute("aria-hidden","false");
      document.body.style.overflow="hidden";
      CURRENT_ID = id;
    }
    function closeModal(){
      modal.classList.remove("active");
      modal.setAttribute("aria-hidden","true");
      player.src = "";
      document.body.style.overflow="";
    }
    let CURRENT_ID = null;
    document.addEventListener("keydown", (e)=>{
      if(!modal.classList.contains("active")) return;
      if(e.key === "Escape") closeModal();
    });
    modal.addEventListener("click", (e)=>{ if(e.target===modal) closeModal(); });
    closeModalBtn.onclick = closeModal;

    // ====== LOAD ======
    function load(){
      loading.style.display = "";
      Papa.parse(SHEET_CSV, {
        download:true, header:true, skipEmptyLines:true,
        complete: (res)=>{
          RAW = res.data.filter(r => r["A YouTube Video Link!"]);
          loading.style.display = "none";
          render();
        },
        error: ()=>{
          grid.innerHTML = `<div class="info">Gagal memuat CSV.</div>`;
        }
      });
    }

    // ====== EVENTS ======
    q.addEventListener("input", ()=>{
      clearBtn.style.display = q.value ? "" : "none";
      render();
    });
    clearBtn.addEventListener("click", ()=>{ q.value=""; clearBtn.style.display="none"; render(); });
    sortSel.addEventListener("change", render);

    // Sidebar navigation improved: use data-view for clarity and less error-prone
    document.querySelectorAll(".sidebar-item[data-view]").forEach(item=>{
      item.addEventListener("click", (e)=>{
        document.querySelectorAll(".sidebar-item").forEach(x=>x.classList.remove("active"));
        item.classList.add("active");
        const view = item.getAttribute("data-view");
        document.querySelectorAll('.page-section').forEach(section => section.classList.remove('active'));
        document.getElementById(view).classList.add('active');
        // If home/favs switch grid, else don't
        if(view === "home" || view === "favorites"){
          VIEW = view;
          activeView.textContent = "View: " + (VIEW==="favorites"?"Favorites":"Home");
          render();
        }
        if(window.innerWidth <= 768) sidebar.classList.remove("show");
      });
    });

    refreshBtn.addEventListener("click", (e)=>{ e.preventDefault(); load(); showToast("Data refreshed", true); });
    viewFavsBtn.addEventListener("click", ()=>{
      VIEW = (VIEW==="favorites" ? "home" : "favorites");
      activeView.textContent = "View: " + (VIEW==="favorites"?"Favorites":"Home");
      render();
      // show tab
      document.querySelectorAll('.page-section').forEach(section => section.classList.remove('active'));
      document.getElementById(VIEW).classList.add('active');
      document.querySelectorAll(".sidebar-item").forEach(x=>x.classList.remove("active"));
      document.querySelector(`.sidebar-item[data-view="${VIEW}"]`)?.classList.add('active');
    });

    // Sidebar toggle
    let sidebarCollapsed = false;
    sidebarToggleBtn.addEventListener('click', ()=>{
      if (window.innerWidth <= 768) {
        sidebar.classList.toggle('show');
      } else {
        sidebarCollapsed = !sidebarCollapsed;
        sidebar.classList.toggle('collapsed');
        mainContent.classList.toggle('expanded');
      }
    });

    // Section navigation for non-sidebar triggers (for direct function use)
    function showSection(event, sectionName) {
      document.querySelectorAll('.page-section').forEach(section => section.classList.remove('active'));
      document.querySelectorAll('.sidebar-item').forEach(item => item.classList.remove('active'));
      document.getElementById(sectionName).classList.add('active');
      document.querySelector(`.sidebar-item[data-view="${sectionName}"]`)?.classList.add('active');
      if (window.innerWidth <= 768) {
        sidebar.classList.remove('show');
      }
      if(sectionName === 'home'){
        VIEW = "home";
        activeView.textContent = "View: Home";
        render();
      }
      if(sectionName === 'favorites'){
        VIEW = "favorites";
        activeView.textContent = "View: Favorites";
        render();
      }
    }

    // Submit video
    function submitVideo(event) {
      event.preventDefault();
      showToast('Fitur submit video akan segera hadir! Sementara gunakan Google Form yang tersedia.');
      event.target.reset();
    }

    // HTML escaping utility for XSS safety
    function escapeHTML(str) {
      return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    }

    // Init
    load();
    setInterval(load, 300000);

    // Accessibility: allow closing modal with Escape globally
    document.addEventListener("keydown", (e)=>{
      if(e.key === "Escape") closeModal();
    });

    // Responsive: hide sidebar on resize if necessary
    window.addEventListener('resize', function() {
      if (window.innerWidth > 768) {
        sidebar.classList.remove('show');
      }
    });
