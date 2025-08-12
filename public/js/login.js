document.getElementById('login-form').addEventListener('submit', async (event) => {
    event.preventDefault(); // Impede o recarregamento da página

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const errorMessage = document.getElementById('error-message');

    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password }),
        });

        const data = await response.json();

        if (response.ok) {
            // Se o login for bem-sucedido, salve um "token" ou uma confirmação
            localStorage.setItem('userToken', data.token); // Salva no navegador
            // Redireciona para a área de membros
            window.location.href = '/membros.html';
        } else {
            // Se o servidor retornar um erro
            errorMessage.textContent = data.error || 'Email ou senha inválidos.';
            errorMessage.style.display = 'block';
        }
    } catch (error) {
        // Se houver um erro de rede
        errorMessage.textContent = 'Erro de conexão. Tente novamente.';
        errorMessage.style.display = 'block';
    }
});