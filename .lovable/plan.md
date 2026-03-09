

# Análise de Segurança e Riscos do Filtro `metadata.type === "banner"`

## 1. Corrigirá o problema?

**PARCIALMENTE — depende de ONDE o outro app coloca o metadata.**

O `event.data.object` é um objeto diferente para cada tipo de evento:

| Evento | `event.data.object` é... | Tem `metadata.type = "banner"`? |
|--------|--------------------------|--------------------------------|
| `checkout.session.completed` | **Session** | Só se o outro app setar no checkout session |
| `customer.subscription.created/updated/deleted` | **Subscription** | ✅ Sim (você confirmou que está na assinatura) |
| `invoice.payment_failed/succeeded` | **Invoice** | ❌ Provavelmente NÃO (invoice metadata é separado) |

**Risco real**: O problema principal reportado (email de boas-vindas indevido) vem do `checkout.session.completed`. O metadata precisa estar no **Session object**, não apenas na subscription. Você precisa confirmar com o outro app se o metadata `type: "banner"` é definido na **criação do checkout session** (via `session.metadata`), não apenas na subscription.

## 2. Funcionará?

**SIM para subscription events. INCERTO para checkout e invoice events.**

- Se o outro app só seta metadata na subscription, eventos de `checkout.session.completed` e `invoice.*` **NÃO seriam filtrados**.
- Para invoices: risco baixo — o update faz `.eq("email", customerEmail)` e se o usuário não existe neste app, 0 rows são afetadas.
- Para checkout: risco ALTO — é exatamente onde o user é criado e o email é enviado.

## 3. É seguro?

**SIM** — o filtro é read-only, não modifica dados. Retorna 200 (evita retries do Stripe). Não afeta eventos legítimos deste app.

## 4. Criará problemas/bugs?

**NÃO para eventos deste app** — eventos sem `metadata.type === "banner"` passam normalmente.

**Potencial falso-negativo**: se o outro app NÃO setar metadata no checkout session, o filtro não pegaria o evento problemático.

---

## Recomendação

Antes de implementar, confirme com o desenvolvedor do outro app:

> "O `metadata.type = 'banner'` é definido no `stripe.checkout.sessions.create({ metadata: { type: 'banner' } })` ou apenas no subscription object?"

- Se está no **checkout session** → o filtro funciona perfeitamente para o problema reportado.
- Se está **apenas na subscription** → precisamos de abordagem diferente (ex: filtrar por price IDs conhecidos deste app, em vez de filtrar por metadata do outro).

### Abordagem alternativa mais robusta

Em vez de filtrar por metadata do outro app, podemos usar **allowlist dos price IDs deste app**:

```typescript
const KNOWN_PRICE_IDS = [
  'price_1RvWXELv0YKLys0d03c5dJqn', // premium
  'price_1RvWXELv0YKLys0dcQphItUR', // pro
];
```

Se o checkout session não contém nenhum desses price IDs, ignorar. Isso é **mais confiável** porque não depende do outro app setar metadata corretamente.

