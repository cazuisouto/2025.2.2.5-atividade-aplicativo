/**
 * script.js - Lógica do Localizador de CEP
 * Integração: ViaCEP API + IndexedDB
 */

// =========================================================
// 1. CONFIGURAÇÃO DO BANCO DE DADOS (IndexedDB)
// =========================================================
let db;
const request = indexedDB.open("CEP_Database", 1);

// Cria o banco e a estrutura se não existir
request.onupgradeneeded = (event) => {
    db = event.target.result;
    if (!db.objectStoreNames.contains("ceps_salvos")) {
        // Usamos o próprio CEP como chave única (keyPath)
        db.createObjectStore("ceps_salvos", { keyPath: "cep" });
    }
};

request.onsuccess = (event) => {
    db = event.target.result;
    console.log("Banco de dados pronto!");
    listarFavoritos(); // Carrega os dados salvos ao abrir a página
};

// =========================================================
// 2. MAPEAMENTO DE ELEMENTOS DO HTML
// =========================================================
const form = document.getElementById('cep-form');
const inputCep = document.getElementById('cep-input');
const feedback = document.getElementById('feedback-container');
const resultSection = document.getElementById('result-display');
const cardResultado = document.getElementById('current-address-card');
const btnSalvar = document.getElementById('save-btn');
const tabelaHistorico = document.getElementById('history-body');

// Objeto global para armazenar temporariamente o último resultado da busca
let enderecoAtual = null;

// =========================================================
// 3. CONSULTA À API VIACEP (READ)
// =========================================================
form.addEventListener('submit', (e) => {
    e.preventDefault();
    const cep = inputCep.value.replace(/\D/g, ''); // Remove qualquer coisa que não seja número

    if (cep.length !== 8) {
        exibirMensagem("Por favor, digite um CEP válido com 8 dígitos.", "danger");
        return;
    }

    exibirMensagem("Buscando...", "info");

    fetch(`https://viacep.com.br/ws/${cep}/json/`)
        .then(response => response.json())
        .then(data => {
            if (data.erro) {
                exibirMensagem("CEP não encontrado!", "danger");
                resultSection.classList.add('hidden');
            } else {
                enderecoAtual = data; // Armazena para salvar depois
                mostrarNoCard(data);
                exibirMensagem("CEP localizado!", "success");
            }
        })
        .catch(error => {
            console.error(error);
            exibirMensagem("Erro na conexão com o servidor.", "danger");
        });
});

// =========================================================
// 4. MANIPULAÇÃO DO HTML DINÂMICO
// =========================================================

// Exibe o resultado da busca atual no Card
function mostrarNoCard(data) {
    resultSection.classList.remove('hidden');
    cardResultado.innerHTML = `
        <p><strong>Logradouro:</strong> ${data.logradouro}</p>
        <p><strong>Bairro:</strong> ${data.bairro}</p>
        <p><strong>Localidade:</strong> ${data.localidade} - ${data.uf}</p>
        <p><strong>CEP:</strong> ${data.cep}</p>
    `;
}

// Exibe mensagens de feedback para o usuário
function exibirMensagem(msg, tipo) {
    const cor = tipo === "danger" ? "#ef4444" : tipo === "success" ? "#10b981" : "#2563eb";
    feedback.innerHTML = `<p style="color: ${cor}">${msg}</p>`;
}

// =========================================================
// 5. OPERAÇÕES DO BANCO DE DADOS (CRUD)
// =========================================================

// --- CREATE: Salvar CEP nos favoritos ---
btnSalvar.addEventListener('click', () => {
    if (!enderecoAtual) return;

    const transacao = db.transaction(["ceps_salvos"], "readwrite");
    const store = transacao.objectStore("ceps_salvos");
    
    const requestAdd = store.add(enderecoAtual);

    requestAdd.onsuccess = () => {
        exibirMensagem("Endereço salvo nos favoritos!", "success");
        listarFavoritos();
    };

    requestAdd.onerror = () => {
        exibirMensagem("Este CEP já está nos seus favoritos.", "danger");
    };
});

// --- RETRIEVE: Listar todos os CEPs salvos na tabela ---
function listarFavoritos() {
    const transacao = db.transaction(["ceps_salvos"], "readonly");
    const store = transacao.objectStore("ceps_salvos");
    const requestAll = store.getAll();

    requestAll.onsuccess = () => {
        const salvos = requestAll.result;
        
        // Limpa a tabela antes de reconstruir
        tabelaHistorico.innerHTML = "";

        salvos.forEach(item => {
            const linha = document.createElement('tr');
            linha.innerHTML = `
                <td>${item.cep}</td>
                <td>${item.logradouro}</td>
                <td>${item.bairro}</td>
                <td>${item.localidade}/${item.uf}</td>
                <td>
                    <button class="btn-delete" onclick="removerFavorito('${item.cep}')">Excluir</button>
                </td>
            `;
            tabelaHistorico.appendChild(linha);
        });
    };
}

// --- DELETE: Remover um CEP dos favoritos ---
function removerFavorito(cep) {
    const transacao = db.transaction(["ceps_salvos"], "readwrite");
    const store = transacao.objectStore("ceps_salvos");
    
    const requestDelete = store.delete(cep);

    requestDelete.onsuccess = () => {
        exibirMensagem("Removido com sucesso.", "success");
        listarFavoritos(); // Atualiza a tabela
    };
}