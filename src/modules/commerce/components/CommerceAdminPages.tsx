'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Megaphone, Percent, Plus, Tag, Trash2, Truck } from 'lucide-react';
import { formatQ, products } from '../../../data/mockData';
import type { Announcement, DiscountCode, Offer, TransferReceipt } from '../../../types';
import { useApp } from '../../../contexts/AppContext';
import { roleService } from '../../../services/roleService';
import { currentDateString, loadPromotionData, loadTransferReceipts, savePromotionData, updateTransferReceipt } from '../services/commerceDataService';

type PromotionTab = 'offers' | 'announcements' | 'codes';

export function OffersAdminPage() {
  const [tab, setTab] = useState<PromotionTab>('offers');
  const [offers, setOffers] = useState<Offer[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [codes, setCodes] = useState<DiscountCode[]>([]);
  const [productId, setProductId] = useState(products[0]?.id || '');
  const [percent, setPercent] = useState('10');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [href, setHref] = useState('/store');
  const [code, setCode] = useState('');
  const [minimum, setMinimum] = useState('0');
  const [maxUses, setMaxUses] = useState('100');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const data = loadPromotionData(products);
    setOffers(data.offers); setAnnouncements(data.announcements); setCodes(data.discountCodes);
  }, []);

  const persist = (nextOffers: Offer[], nextAnnouncements: Announcement[], nextCodes: DiscountCode[]) => {
    const saved = savePromotionData({ offers: nextOffers, announcements: nextAnnouncements, discountCodes: nextCodes });
    setNotice(saved ? 'Cambios guardados. La tienda ya refleja la actualización.' : 'No se pudieron guardar los cambios en este navegador.');
    return saved;
  };

  const submitOffer = (event: FormEvent) => {
    event.preventDefault();
    const product = products.find((item) => item.id === productId);
    const percentage = Number(percent);
    if (!product || !Number.isFinite(percentage) || percentage < 1 || percentage > 80) { setNotice('Elige un producto y un descuento de 1% a 80%.'); return; }
    const originalPrice = product.compareAt && product.compareAt > product.price ? product.compareAt : product.price;
    const today = currentDateString();
    const next: Offer = { id: `offer-${Date.now()}`, productId, originalPrice, discountedPrice: Math.round(originalPrice * (1 - percentage / 100)), startsAt: today, endsAt: `${Number(today.slice(0, 4)) + 1}-12-31`, status: 'Activa' };
    const nextOffers = [next, ...offers.filter((item) => item.productId !== productId)];
    if (persist(nextOffers, announcements, codes)) setOffers(nextOffers);
  };

  const submitAnnouncement = (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim() || !description.trim() || !href.startsWith('/') || href.startsWith('//')) { setNotice('Completa el título, la descripción y usa un enlace interno que empiece con /.'); return; }
    const next: Announcement = { id: `announcement-${Date.now()}`, title: title.trim(), description: description.trim(), href: href.trim(), status: 'Activa' };
    const nextAnnouncements = [next, ...announcements];
    if (persist(offers, nextAnnouncements, codes)) { setAnnouncements(nextAnnouncements); setTitle(''); setDescription(''); }
  };

  const submitCode = (event: FormEvent) => {
    event.preventDefault();
    const normalized = code.trim().toUpperCase().replace(/\s+/g, '');
    const percentage = Number(percent);
    const uses = Number(maxUses);
    const min = Number(minimum);
    if (!/^[A-Z0-9-]{3,24}$/.test(normalized) || codes.some((item) => item.code.toUpperCase() === normalized) || percentage < 1 || percentage > 80 || uses < 1 || min < 0) { setNotice('Revisa el código, el porcentaje (1–80), la compra mínima y el límite de usos.'); return; }
    const today = currentDateString();
    const next: DiscountCode = { id: `code-${Date.now()}`, code: normalized, discountPercent: percentage, minPurchase: min, maxUses: uses, usedCount: 0, startsAt: today, endsAt: `${Number(today.slice(0, 4)) + 1}-12-31`, status: 'Activo' };
    const nextCodes = [next, ...codes];
    if (persist(offers, announcements, nextCodes)) { setCodes(nextCodes); setCode(''); }
  };

  const toggleOffer = (item: Offer) => {
    const next = offers.map((offer) => offer.id === item.id ? { ...offer, status: offer.status === 'Activa' ? 'Pausada' as const : 'Activa' as const } : offer);
    if (persist(next, announcements, codes)) setOffers(next);
  };
  const toggleAnnouncement = (item: Announcement) => {
    const next = announcements.map((announcement) => announcement.id === item.id ? { ...announcement, status: announcement.status === 'Activa' ? 'Pausada' as const : 'Activa' as const } : announcement);
    if (persist(offers, next, codes)) setAnnouncements(next);
  };
  const toggleCode = (item: DiscountCode) => {
    const next = codes.map((discountCode) => discountCode.id === item.id ? { ...discountCode, status: discountCode.status === 'Activo' ? 'Pausado' as const : 'Activo' as const } : discountCode);
    if (persist(offers, announcements, next)) setCodes(next);
  };
  const removeOffer = (item: Offer) => { const next = offers.filter((offer) => offer.id !== item.id); if (persist(next, announcements, codes)) setOffers(next); };
  const removeAnnouncement = (item: Announcement) => { const next = announcements.filter((announcement) => announcement.id !== item.id); if (persist(offers, next, codes)) setAnnouncements(next); };
  const removeCode = (item: DiscountCode) => { const next = codes.filter((discountCode) => discountCode.id !== item.id); if (persist(offers, announcements, next)) setCodes(next); };

  const selectedProduct = products.find((item) => item.id === productId);
  const previewPrice = selectedProduct ? Math.round((selectedProduct.compareAt && selectedProduct.compareAt > selectedProduct.price ? selectedProduct.compareAt : selectedProduct.price) * (1 - Number(percent || 0) / 100)) : 0;
  return <main className="admin-page offers-page"><div className="admin-page-heading"><div><span className="eyebrow">Marketing de tienda</span><h1>Ofertas y anuncios</h1><p>Publica precios especiales, novedades y códigos de descuento.</p></div></div>{notice && <p className="commerce-notice" role="status">{notice}</p>}<div className="offers-layout"><section className="panel offers-list-panel"><div className="offers-tabs"><button type="button" className={tab === 'offers' ? 'active' : ''} onClick={() => setTab('offers')}><Percent size={15} /> Ofertas ({offers.length})</button><button type="button" className={tab === 'announcements' ? 'active' : ''} onClick={() => setTab('announcements')}><Megaphone size={15} /> Anuncios ({announcements.length})</button><button type="button" className={tab === 'codes' ? 'active' : ''} onClick={() => setTab('codes')}><Tag size={15} /> Códigos ({codes.length})</button></div><div className="promotion-list">
    {tab === 'offers' && offers.map((offer) => { const product = products.find((item) => item.id === offer.productId); if (!product) return null; return <div className="promotion-row" key={offer.id}><img src={product.image} alt={product.name} loading="lazy" /><div><strong>{product.name}</strong><span>{offer.status} · Hasta {offer.endsAt}</span><small>{formatQ(offer.discountedPrice)} <del>{formatQ(offer.originalPrice)}</del></small></div><div className="promotion-row-actions"><button type="button" className={`status-switch ${offer.status === 'Activa' ? 'on' : ''}`} onClick={() => toggleOffer(offer)} aria-label={offer.status === 'Activa' ? 'Pausar oferta' : 'Activar oferta'}><i /></button><button type="button" className="icon-button danger" onClick={() => removeOffer(offer)} aria-label="Eliminar oferta"><Trash2 size={15} /></button></div></div>; })}
    {tab === 'announcements' && announcements.map((item) => <div className="promotion-row announcement-row" key={item.id}><span className="announcement-icon"><Megaphone size={17} /></span><div><strong>{item.title}</strong><small>{item.description}</small><span>{item.status} · {item.href}</span></div><div className="promotion-row-actions"><button type="button" className={`status-switch ${item.status === 'Activa' ? 'on' : ''}`} onClick={() => toggleAnnouncement(item)} aria-label={item.status === 'Activa' ? 'Pausar anuncio' : 'Activar anuncio'}><i /></button><button type="button" className="icon-button danger" onClick={() => removeAnnouncement(item)} aria-label="Eliminar anuncio"><Trash2 size={15} /></button></div></div>)}
    {tab === 'codes' && codes.map((item) => <div className="promotion-row announcement-row" key={item.id}><span className="announcement-icon"><Tag size={17} /></span><div><strong>{item.code} · {item.discountPercent}%</strong><small>{item.status} · {item.usedCount}/{item.maxUses} usos · Mínimo {formatQ(item.minPurchase)}</small><span>Vence {item.endsAt}</span></div><div className="promotion-row-actions"><button type="button" className={`status-switch ${item.status === 'Activo' ? 'on' : ''}`} onClick={() => toggleCode(item)} aria-label={item.status === 'Activo' ? 'Pausar código' : 'Activar código'}><i /></button><button type="button" className="icon-button danger" onClick={() => removeCode(item)} aria-label="Eliminar código"><Trash2 size={15} /></button></div></div>)}
    {((tab === 'offers' && !offers.length) || (tab === 'announcements' && !announcements.length) || (tab === 'codes' && !codes.length)) && <p className="commerce-empty">Todavía no hay elementos en esta sección.</p>}
  </div></section><section className="panel promotion-form-panel"><div className="panel-heading"><div><span className="eyebrow">Nuevo registro</span><h2>{tab === 'offers' ? 'Crear oferta' : tab === 'announcements' ? 'Crear anuncio' : 'Crear código'}</h2></div></div>
    {tab === 'offers' && <form className="promotion-form" onSubmit={submitOffer}><label className="form-field">Producto<select value={productId} onChange={(event) => setProductId(event.target.value)}>{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label><label className="form-field">Descuento (%)<input type="number" min="1" max="80" value={percent} onChange={(event) => setPercent(event.target.value)} /></label><div className="promotion-preview"><span>Precio de oferta</span><strong>{formatQ(previewPrice)}</strong></div><button className="button button-primary" type="submit"><Plus size={16} /> Guardar oferta</button></form>}
    {tab === 'announcements' && <form className="promotion-form" onSubmit={submitAnnouncement}><label className="form-field">Título<input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={70} required /></label><label className="form-field">Descripción<textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={160} required /></label><label className="form-field">Enlace interno<input value={href} onChange={(event) => setHref(event.target.value)} placeholder="/store" required /></label><button className="button button-primary" type="submit"><Plus size={16} /> Publicar anuncio</button></form>}
    {tab === 'codes' && <form className="promotion-form" onSubmit={submitCode}><label className="form-field">Código<input value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} maxLength={24} placeholder="NEXO15" required /></label><div className="promotion-form-grid"><label className="form-field">Descuento (%)<input type="number" min="1" max="80" value={percent} onChange={(event) => setPercent(event.target.value)} required /></label><label className="form-field">Usos máximos<input type="number" min="1" value={maxUses} onChange={(event) => setMaxUses(event.target.value)} required /></label></div><label className="form-field">Compra mínima (Q)<input type="number" min="0" step="0.01" value={minimum} onChange={(event) => setMinimum(event.target.value)} required /></label><button className="button button-primary" type="submit"><Plus size={16} /> Crear código</button></form>}
  </section></div></main>;
}

export function TransferReceiptsPage() {
  const { role } = useApp();
  const canApprove = Boolean(role && roleService.can(role, 'orders', 'approve'));
  const [receipts, setReceipts] = useState<TransferReceipt[]>([]);
  const [selected, setSelected] = useState<TransferReceipt | null>(null);
  const [notice, setNotice] = useState('');
  useEffect(() => setReceipts(loadTransferReceipts()), []);
  const update = (receipt: TransferReceipt, status: TransferReceipt['status']) => {
    if (!canApprove) { setNotice('Tu rol puede consultar comprobantes, pero no aprobarlos.'); return; }
    if (!updateTransferReceipt(receipt.id, status)) { setNotice('No se pudo guardar el cambio.'); return; }
    setReceipts((items) => items.map((item) => item.id === receipt.id ? { ...item, status } : item));
    setSelected((item) => item?.id === receipt.id ? { ...item, status } : item);
    setNotice(`Comprobante ${status.toLowerCase()}.`);
  };
  const pendingCount = receipts.filter((item) => item.status === 'Pendiente').length;
  return <main className="admin-page transfer-review-page"><div className="admin-page-heading"><div><span className="eyebrow">Verificación de pagos</span><h1>Comprobantes de transferencia</h1><p>{pendingCount} pendiente{pendingCount === 1 ? '' : 's'} de revisión.</p></div></div>{notice && <p className="commerce-notice" role="status">{notice}</p>}{receipts.length ? <div className="transfer-receipt-grid">{receipts.map((receipt) => <article className="panel transfer-receipt-card" key={receipt.id}><button type="button" className="receipt-image-button" onClick={() => setSelected(receipt)} aria-label={`Ver comprobante de ${receipt.customer}`}><img src={receipt.image} alt={`Comprobante de ${receipt.customer}`} /></button><div className="transfer-receipt-copy"><span className={`receipt-status ${receipt.status.toLowerCase()}`}>{receipt.status}</span><h2>{receipt.customer}</h2><p>Pedido {receipt.orderId || receipt.id}</p>{receipt.phone && <p>Tel. {receipt.phone}</p>}{receipt.address && <p>{receipt.address}</p>}{receipt.reference && <p>Referencia: {receipt.reference}</p>}<strong>{formatQ(receipt.total)}</strong><small>{new Date(receipt.date).toLocaleString('es-GT')}</small></div><div className="transfer-receipt-actions"><button type="button" className="button button-outline" onClick={() => setSelected(receipt)}>Ver comprobante</button>{receipt.status === 'Pendiente' && canApprove && <><button type="button" className="button button-primary" onClick={() => update(receipt, 'Aprobada')}>Aprobar</button><button type="button" className="button button-danger" onClick={() => update(receipt, 'Rechazada')}>Rechazar</button></>}</div></article>)}</div> : <div className="panel commerce-empty"><Truck size={26} /><h2>No hay comprobantes todavía</h2><p>Los pedidos pagados con transferencia aparecerán aquí para revisión.</p></div>}{selected && <div className="receipt-lightbox" role="dialog" aria-modal="true" aria-label="Comprobante de transferencia" onClick={() => setSelected(null)}><button type="button" className="receipt-lightbox-close" onClick={() => setSelected(null)}>Cerrar</button><img src={selected.image} alt={`Comprobante de ${selected.customer}`} onClick={(event) => event.stopPropagation()} /><div className="receipt-lightbox-caption">{selected.customer} · {formatQ(selected.total)} · {selected.status}</div></div>}</main>;
}
