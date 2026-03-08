#!/bin/bash

# Nome do arquivo final
SAIDA="projeto_completo.txt"

# 1. Limpa o arquivo se ele já existir
> "$SAIDA"

# 2. Busca arquivos .js, ignorando node_modules e pastas de build (.next, dist, etc)
find . -name "node_modules" -prune -o \
       -name ".next" -prune -o \
       -name "dist" -prune -o \
       -name "*.js" -print | while read -r arquivo; do

    # Adiciona um cabeçalho para saber de qual arquivo veio o código
    echo -e "\n\n// --- ARQUIVO: $arquivo ---\n" >> "$SAIDA"
    
    # Concatena o conteúdo
    cat "$arquivo" >> "$SAIDA"
done

echo "Concluído! Verifique o arquivo: $SAIDA"