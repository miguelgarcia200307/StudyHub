// =================================================================
// GESTOR DE LOADING GLOBAL Y UTILIDADES UX
// =================================================================

class LoadingManager {
    constructor() {
        this.createLoadingOverlay();
        this.setupMobileMenu();
    }

    // Crear overlay de loading global
    createLoadingOverlay() {
        const overlay = document.createElement('div');
        overlay.className = 'loading-overlay';
        overlay.id = 'global-loading';
        overlay.innerHTML = `
            <div class="loading-content">
                <div class="loading-spinner"></div>
                <div class="loading-text" id="loading-text">Cargando...</div>
            </div>
        `;
        document.body.appendChild(overlay);
    }

    // Mostrar loading global
    show(message = 'Cargando...') {
        const overlay = document.getElementById('global-loading');
        const text = document.getElementById('loading-text');
        if (overlay && text) {
            text.textContent = message;
            overlay.classList.add('active');
        }
    }

    // Ocultar loading global
    hide() {
        const overlay = document.getElementById('global-loading');
        if (overlay) {
            overlay.classList.remove('active');
        }
    }

    // Loading en botón específico
    showButtonLoading(button, loadingText = '') {
        if (!button) return;
        
        button.disabled = true;
        button.classList.add('loading');
        
        // Buscar o crear spinner
        let spinner = button.querySelector('.loading-spinner');
        if (!spinner) {
            spinner = document.createElement('div');
            spinner.className = 'loading-spinner';
            button.appendChild(spinner);
        }
        
        // Ocultar texto original
        const spans = button.querySelectorAll('span:not(.loading-spinner)');
        const icons = button.querySelectorAll('i:not(.loading-spinner)');
        
        spans.forEach(span => span.style.display = 'none');
        icons.forEach(icon => icon.style.display = 'none');
        
        // Mostrar spinner
        spinner.style.display = 'inline-block';
        
        // Agregar texto de loading si se proporciona
        if (loadingText) {
            let loadingTextSpan = button.querySelector('.loading-text');
            if (!loadingTextSpan) {
                loadingTextSpan = document.createElement('span');
                loadingTextSpan.className = 'loading-text';
                button.appendChild(loadingTextSpan);
            }
            loadingTextSpan.textContent = loadingText;
            loadingTextSpan.style.display = 'inline';
        }
    }

    // Quitar loading de botón específico
    hideButtonLoading(button) {
        if (!button) return;
        
        button.disabled = false;
        button.classList.remove('loading');
        
        // Ocultar spinner
        const spinner = button.querySelector('.loading-spinner');
        if (spinner) {
            spinner.style.display = 'none';
        }
        
        // Mostrar contenido original
        const spans = button.querySelectorAll('span:not(.loading-spinner):not(.loading-text)');
        const icons = button.querySelectorAll('i:not(.loading-spinner)');
        
        spans.forEach(span => span.style.display = 'inline');
        icons.forEach(icon => icon.style.display = 'inline');
        
        // Ocultar texto de loading
        const loadingText = button.querySelector('.loading-text');
        if (loadingText) {
            loadingText.style.display = 'none';
        }
    }

    // Configurar menú móvil
    setupMobileMenu() {
        // Crear overlay para sidebar móvil
        const overlay = document.createElement('div');
        overlay.className = 'sidebar-overlay';
        overlay.id = 'sidebar-overlay';
        document.body.appendChild(overlay);

        // Botón de menú móvil
        const mobileToggle = document.getElementById('mobile-menu-toggle');
        const sidebar = document.getElementById('sidebar');
        
        if (mobileToggle && sidebar) {
            mobileToggle.addEventListener('click', () => {
                this.toggleMobileMenu();
            });
        }

        // Cerrar al hacer click en overlay
        overlay.addEventListener('click', () => {
            this.closeMobileMenu();
        });

        // Cerrar con tecla Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeMobileMenu();
            }
        });
    }

    // Alternar menú móvil
    toggleMobileMenu() {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        
        if (sidebar && overlay) {
            const isOpen = sidebar.classList.contains('mobile-open');
            
            if (isOpen) {
                this.closeMobileMenu();
            } else {
                this.openMobileMenu();
            }
        }
    }

    // Abrir menú móvil
    openMobileMenu() {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        
        if (sidebar && overlay) {
            sidebar.classList.add('mobile-open');
            overlay.classList.add('active');
            document.body.style.overflow = 'hidden'; // Prevenir scroll
        }
    }

    // Cerrar menú móvil
    closeMobileMenu() {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        
        if (sidebar && overlay) {
            sidebar.classList.remove('mobile-open');
            overlay.classList.remove('active');
            document.body.style.overflow = ''; // Restaurar scroll
        }
    }

    // Wrapper para operaciones asíncronas con loading
    async withLoading(operation, message = 'Procesando...') {
        try {
            this.show(message);
            const result = await operation();
            return result;
        } finally {
            this.hide();
        }
    }

    // Wrapper para operaciones de botón con loading
    async withButtonLoading(button, operation, loadingText = '') {
        try {
            this.showButtonLoading(button, loadingText);
            const result = await operation();
            return result;
        } finally {
            this.hideButtonLoading(button);
        }
    }
}

// =================================================================
// UTILIDADES UX ADICIONALES
// =================================================================

class UXUtils {
    // Debounce para búsquedas
    static debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // Detectar si es dispositivo móvil
    static isMobile() {
        return window.innerWidth <= 768;
    }

    // Detectar si es tablet
    static isTablet() {
        return window.innerWidth > 768 && window.innerWidth <= 1024;
    }

    // Scroll suave a elemento
    static scrollToElement(element, offset = 0) {
        if (element) {
            const top = element.offsetTop - offset;
            window.scrollTo({
                top: top,
                behavior: 'smooth'
            });
        }
    }

    // Copiar texto al portapapeles
    static async copyToClipboard(text) {
        try {
            if (navigator.clipboard) {
                await navigator.clipboard.writeText(text);
                return true;
            } else {
                // Fallback para navegadores antiguos
                const textArea = document.createElement('textarea');
                textArea.value = text;
                textArea.style.position = 'fixed';
                textArea.style.opacity = '0';
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                const successful = document.execCommand('copy');
                document.body.removeChild(textArea);
                return successful;
            }
        } catch (err) {
            console.error('Error copying to clipboard:', err);
            return false;
        }
    }

    // Validar email
    static isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    // Validar username
    static isValidUsername(username) {
        const usernameRegex = /^[a-zA-Z0-9_]{3,50}$/;
        return usernameRegex.test(username);
    }

    // Formatear fecha para mostrar
    static formatDate(date, options = {}) {
        const defaultOptions = {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        };
        
        const finalOptions = { ...defaultOptions, ...options };
        
        return new Intl.DateTimeFormat('es-ES', finalOptions).format(new Date(date));
    }

    // Truncar texto
    static truncateText(text, maxLength = 100) {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength).trim() + '...';
    }

    // Generar color aleatorio
    static randomColor() {
        const colors = [
            '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
            '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    // Escapar HTML
    static escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// =================================================================
// INICIALIZACIÓN GLOBAL
// =================================================================

// Instancia global del gestor de loading
window.loadingManager = new LoadingManager();
window.UXUtils = UXUtils;

// Configuración inicial
document.addEventListener('DOMContentLoaded', function() {
    // Configurar viewport para móviles
    if (UXUtils.isMobile()) {
        document.body.classList.add('mobile-device');
    }
    
    // Configurar eventos de redimensionado
    window.addEventListener('resize', UXUtils.debounce(() => {
        if (UXUtils.isMobile()) {
            document.body.classList.add('mobile-device');
            // Cerrar sidebar en móvil si está abierto
            window.loadingManager.closeMobileMenu();
        } else {
            document.body.classList.remove('mobile-device');
        }
    }, 250));
    
    // Configurar clic en enlaces de navegación para cerrar menú móvil
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            if (UXUtils.isMobile()) {
                window.loadingManager.closeMobileMenu();
            }
        });
    });
});

console.log('🎨 LoadingManager y UXUtils inicializados correctamente');
