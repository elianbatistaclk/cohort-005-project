# Cadence

Plataforma de cursos online: instrutores publicam cursos, pessoas e times compram acesso e estudam.

## Language

### Pessoas

**User**:
A conta de alguém na plataforma, independente do que essa pessoa faz nela.
_Avoid_: Account

**Student**:
Um User que tem acesso a um curso para estudá-lo.
_Avoid_: Learner, member (no sentido de quem estuda)

**Buyer**:
O User que pagou por uma Purchase. Numa compra para time, o Buyer pode não ser Student.
_Avoid_: Purchaser, customer

**Instructor**:
O User dono de um curso, que o cria e responde às Questions.

### Compra e acesso

**Purchase**:
O pagamento de um Buyer por um curso, individual ou para um time.
_Avoid_: Order, transaction

**Enrollment**:
O vínculo que dá a um Student acesso a um curso.
_Avoid_: Registration

**Refund**:
A devolução, pedida pelo Buyer, do valor de uma Purchase, revisada manualmente pela equipe.
_Avoid_: Chargeback, Reversal, Cancellation

**Refund Request**:
Um Refund que ainda aguarda revisão.
_Avoid_: Pending Chargeback, open cancellation

**Chargeback**:
Contestação de uma cobrança feita pelo titular do cartão diretamente ao banco, fora da plataforma. Não é tratada pelo sistema hoje.
_Avoid_: usar como sinônimo de Refund

### Times

**Team**:
Um grupo que compra Seats de um curso para distribuir entre seus membros.
_Avoid_: Organization, company

**Team Member**:
Um User que pertence a um Team, como admin ou membro comum. Quem faz Claim de um Seat torna-se Team Member.

**Seat**:
O direito de acesso a um curso, comprado em lote por um Team, que pode ser entregue a uma pessoa.
_Avoid_: Coupon, licence, team seat, minted seat

**Seat Code**:
O código compartilhável que permite a uma pessoa fazer Claim de um Seat.
_Avoid_: Coupon code, redemption link, coupon link

**Claim**:
O ato de uma pessoa tomar posse de um Seat usando um Seat Code, o que gera seu Enrollment.
_Avoid_: Redeem, redemption

### Estudo

**Module**:
Um agrupamento ordenado de aulas dentro de um curso.
_Avoid_: Curriculum, course content, section, chapter

**Course Progress**:
A fração das aulas de um curso que o Student concluiu.
_Avoid_: Progress (sem qualificador), completion

**Watch Position**:
O ponto até onde o Student assistiu ao vídeo de uma aula.
_Avoid_: Watch progress, video progress

**Completed Course**:
Um curso em que o Student concluiu todas as aulas.
_Avoid_: Finished

### Conversa

**Comment**:
Uma mensagem publicada na discussão de uma aula, inclusive respostas.
_Avoid_: Discussion, thread, post

**Question**:
Um Comment de primeiro nível feito por um Student que ainda não recebeu resposta da equipe do curso.
_Avoid_: usar para itens de quiz

**Quiz Question**:
Um item de um quiz de aula, com suas opções de resposta.
_Avoid_: Question (sem qualificador)
