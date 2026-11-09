import { useCallback, useMemo, useState } from 'react'
import { MdChevronLeft, MdChevronRight, MdPrint } from 'react-icons/md'
import Modal from '../../../components/Modal.jsx'
import { InlineNotice, Loading, Notice } from '../../../components/States.jsx'
import { useAsync } from '../../../hooks/useAsync.js'
import { printReceipt } from '../../../services/puraPrint.js'
import { errorMessage } from '../../../utils/errors.js'
import { btnIcon, btnPrimary } from '../../../utils/ui.js'
import { createLabelImages } from './labelImage.js'
import { buildLabels } from './supplier.js'

function Carousel({ labels, images, missing }) {
  const [index, setIndex] = useState(0)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState(null)

  const label = labels[index]
  const go = (step) => setIndex((i) => (i + step + labels.length) % labels.length)

  // Se llama directo desde el clic: PuraPrint se abre dentro del gesto del usuario.
  function print() {
    setBusy(true)
    setNotice(null)
    printReceipt({
      generate: async () => images[index],
      title: `Etiqueta ${label.ref} ${label.size}`,
      orderId: label.orderId,
    })
      .then(
        () =>
          setNotice({
            type: 'ok',
            text: 'Etiqueta enviada a PuraPrint. Conecta la impresora allá para imprimirla.',
          }),
        (e) => setNotice({ type: 'error', text: errorMessage(e) }),
      )
      .finally(() => setBusy(false))
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          aria-label="Etiqueta anterior"
          onClick={() => go(-1)}
          className={btnIcon}
        >
          <MdChevronLeft className="size-6" aria-hidden="true" />
        </button>
        <p role="status" className="text-center text-sm font-semibold">
          Etiqueta {index + 1} de {labels.length}
        </p>
        <button
          type="button"
          aria-label="Etiqueta siguiente"
          onClick={() => go(1)}
          className={btnIcon}
        >
          <MdChevronRight className="size-6" aria-hidden="true" />
        </button>
      </div>
      <img
        src={images[index]}
        alt={`Etiqueta de ${label.shirt} talla ${label.size} del pedido ${label.ref}`}
        className="mx-auto w-full max-w-[384px] rounded-md border border-border bg-white"
      />
      <button type="button" disabled={busy} onClick={print} className={btnPrimary}>
        <MdPrint className="size-5" aria-hidden="true" />
        {busy ? 'Abriendo…' : 'Imprimir esta etiqueta'}
      </button>
      <Notice notice={notice} />
      {missing > 0 && (
        <p className="text-sm text-muted">
          ⚠ {missing} camisa(s) sin etiqueta: su pedido de cliente ya no existe o fue cancelado.
        </p>
      )}
    </div>
  )
}

function LabelsContent({ supplierOrder, orders }) {
  const built = useMemo(() => buildLabels(supplierOrder, orders), [supplierOrder, orders])
  const load = useCallback(() => createLabelImages(built.labels), [built.labels])
  const images = useAsync(load)

  if (built.labels.length === 0) {
    return (
      <InlineNotice
        notice={{ type: 'error', text: 'No hay camisas con pedido de cliente activo.' }}
      />
    )
  }
  if (images.error) {
    return <InlineNotice notice={{ type: 'error', text: errorMessage(images.error) }} />
  }
  if (images.loading) return <Loading />
  return <Carousel labels={built.labels} images={images.data} missing={built.missing} />
}

/**
 * Etiquetas de entrega de un pedido a proveedor que ya llegó: una por camisa, de a una a la vez
 * (carrusel), para imprimir en la térmica con PuraPrint y pegar en las bolsas. El QR de cada una
 * es la guía de rastreo del pedido del cliente.
 */
export default function LabelsModal({ open, onClose, supplierOrder, orders }) {
  return (
    <Modal open={open} onClose={onClose} title="Etiquetas de entrega">
      <LabelsContent supplierOrder={supplierOrder} orders={orders} />
    </Modal>
  )
}
